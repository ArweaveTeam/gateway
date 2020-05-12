import { get, put } from "../../lib/buckets";
import { APIRequest, APIResponse, APIError } from "../../lib/api-handler";
import { redirectToSandbox } from "./middleware/sandbox";
import { PathPatterns } from ".";
import { fetchTransactionData } from "../../lib/arweave";
import { resolveTx } from "../../lib/path-manifest";

/**
 * Handles requests for data on the magic gateway endpoint.
 *
 * Responsible for ensuring the correct sandboxed origins are used,
 * and redirects requests that aren't.
 *
 *
 * TODO:
 * Responsible for resolving path manifest URLs.
 */
export const handler = async (request: APIRequest, response: APIResponse) => {
  console.log(request.path);
  const txid = getTxIdFromPath(request.path);

  if (redirectToSandbox(request, response, { txid })) {
    return;
  }

  const { data, contentType } = await fetchAndCache(txid);

  console.log(contentType);

  if (
    contentType &&
    contentType.toLowerCase() == "application/x.arweave-manifest+json"
  ) {
    const subpath = getManifestSubpath(request.path);

    const resolvedTx = resolveTx(JSON.parse(data.toString()), subpath);

    if (resolvedTx) {
      const { data, contentType } = await fetchAndCache(resolvedTx);

      return sendData({
        txid: resolvedTx,
        contentType,
        data,
        response,
        status: 200,
      });
    }
  }

  return sendData({
    txid,
    contentType,
    data,
    response,
    status: 200,
  });
};

const sendData = async ({
  response,
  txid,
  data,
  contentType,
  status,
}: {
  response: APIResponse;
  txid: string;
  data: Buffer;
  contentType: string | undefined;
  status: number;
}) => {
  response.sendStatus(status);

  if (contentType) {
    response.type(contentType);
  }

  response.header("etag", txid);

  response.cache("public, immutable, max-age=31536000");

  return response.sendFile(data, {
    cacheControl: false,
  });
};

const cachePut = async (
  txid: string,
  data: Buffer,
  contentType: string | undefined
): Promise<void> => {
  return put("tx-data", `tx/${txid}`, data, {
    contentType,
  });
};

const cacheGet = async (
  txid: string
): Promise<
  | {
      data: Buffer;
      contentType: string | undefined;
    }
  | undefined
> => {
  try {
    const { Body, ContentType } = await get("tx-data", `tx/${txid}`);

    if (Body) {
      return {
        data: Buffer.from(Body),
        contentType: ContentType,
      };
    }
  } catch (error) {
    console.error(error);
  }
};

const fetchAndCache = async (
  txid: string
): Promise<{ data: Buffer; contentType: string | undefined }> => {
  const cached = await cacheGet(txid);
  if (cached) {
    return cached;
  }

  try {
    const { data, contentType } = await fetchTransactionData(txid);

    if (data.byteLength > 1) {
      await cachePut(txid, data, contentType);
    }

    return {
      data,
      contentType,
    };
  } catch (error) {
    throw new APIError(404, "not found");
  }
};

// If the request path starts with 43 characters that look
// like a valid arweave txid, then extract and return that,
// otherwise, return null.
const getTxIdFromPath = (path: string): string => {
  const id = path.match(PathPatterns.extractTransactionId);
  if (id) {
    return id[1];
  }

  throw new APIError(404, "not found");
};

const getManifestSubpath = (path: string): string | undefined => {
  const subpath = path.match(PathPatterns.extractManifestSubpath);
  if (subpath) {
    return subpath[1];
  }
};
