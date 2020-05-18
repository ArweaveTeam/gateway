import { getTxIdFromPath } from ".";
import {
  APIError,
  APIHandler,
  APIRequest,
  APIResponse,
} from "../../lib/api-handler";
import { fetchTransactionData } from "../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../lib/arweave-path-manifest";
import { get, put } from "../../lib/buckets";

export const handler: APIHandler = async (request, response) => {
  const txid = getTxIdFromPath(request.path);

  if (txid) {
    const { data, contentType } = await fetchAndCache(txid);

    if (contentType == "application/x.arweave-manifest+json") {
      return handleManifest(
        request,
        response,
        JSON.parse(data.toString("utf8"))
      );
    }

    return sendData({
      txid,
      contentType,
      data,
      response,
      status: 200,
    });
  }

  throw new APIError(404, "not_found");
};

const handleManifest = async (
  request: APIRequest,
  response: APIResponse,
  manifest: PathManifest
) => {
  const subpath = getManifestSubpath(request.path);

  console.log("subpath", request.path, subpath);

  const resolvedTx = resolveManifestPath(manifest, subpath);

  console.log("resolvedTx", subpath, resolvedTx);

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

  throw new APIError(404, "not_found");
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

const getManifestSubpath = (requestPath: string): string | undefined => {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
};
