import { fetchTransactionData } from "../../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../../lib/arweave-path-manifest";
import { get, put } from "../../../lib/buckets";
import { RequestHandler, Request, Response, response } from "express";
import createError from "http-errors";

const getTxIdFromPath = (path: string): string | undefined => {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
};

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const { data, contentType } = await fetchAndCache(txid);

    if (contentType == "application/x.arweave-manifest+json") {
      req.log.info("[get-data] manifest content-type detected", { txid });
      return handleManifest(req, res, JSON.parse(data.toString("utf8")), txid);
    }

    res.header("etag", txid);
    res.type(contentType || "text/plain");
    res.send(data);
  }
};

const handleManifest = async (
  req: Request,
  res: Response,
  manifest: PathManifest,
  txid: string
) => {
  const subpath = getManifestSubpath(req.path);

  if (req.path == `/${txid}`) {
    res.redirect(301, `${req.path}/`);
    return;
  }

  const resolvedTx = resolveManifestPath(manifest, subpath);

  req.log.info("[get-data] resolved manifest path content", {
    subpath,
    resolvedTx,
  });

  if (resolvedTx) {
    const { data, contentType } = await fetchAndCache(resolvedTx);

    res.header("etag", resolvedTx);
    res.type(contentType || "text/plain");
    res.send(data);
  }
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
    throw new createError.NotFound();
  }
};

const getManifestSubpath = (requestPath: string): string | undefined => {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
};
