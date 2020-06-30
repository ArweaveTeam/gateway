import { fetchTransactionData } from "../../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../../lib/arweave-path-manifest";
import { put, getStream, putStream } from "../../../lib/buckets";
import { RequestHandler, Request, Response } from "express";
import { streamToJson } from "../../../lib/encoding";
import { Readable, PassThrough } from "stream";

const getTxIdFromPath = (path: string): string | undefined => {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
};

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const { stream, contentType, cached } = await getData(txid);

    res.header("etag", txid);

    if (stream) {
      if (contentType == "application/x.arweave-manifest+json") {
        req.log.info("[get-data] manifest content-type detected", { txid });

        return handleManifest(req, res, await streamToJson(stream), txid);
      }

      res.type(contentType || "text/html");

      if (cached) {
        stream.pipe(res);
      } else {
        await sendAndCache({ txid, req, res, stream, contentType });
      }
    }
  }
};

const sendAndCache = async ({
  txid,
  contentType,
  stream,
  res,
  req,
}: {
  txid: string;
  contentType: undefined | string;
  stream: Readable;
  req: Request;
  res: Response;
}) => {
  res.type(contentType || "text/plain");

  const cacheStream = PassThrough.from(stream, { autoDestroy: true });
  const userStream = PassThrough.from(stream, { autoDestroy: true });

  const upload = await putStream("tx-data", `tx/${txid}`, {
    contentType,
  });

  const abort = (err?: any) => {
    cacheStream.destroy();
    userStream.destroy();
    stream.destroy();
    upload.upload.abort();
    res.end();
  };

  req.on("error", abort);
  stream.on("error", abort);
  userStream.on("error", abort);
  cacheStream.on("error", abort);

  cacheStream.pipe(upload.stream);
  userStream.pipe(res);

  await upload.upload.promise();
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

  // return resolvedTx;

  req.log.info("[get-data] resolved manifest path content", {
    subpath,
    resolvedTx,
  });

  if (resolvedTx) {
    const { stream, contentType, cached } = await getData(resolvedTx);

    res.type(contentType || "text/html");

    if (stream) {
      if (cached) {
        stream.pipe(res);
      } else {
        await sendAndCache({ txid, req, res, stream, contentType });
      }
    }
  }
};

const getData = async (
  txid: string
): Promise<{ stream?: Readable; contentType?: string; cached?: boolean }> => {
  try {
    const { stream, contentType } = await getStream("tx-data", `tx/${txid}`);

    if (stream) {
      return {
        stream,
        contentType,
        cached: true,
      };
    }
  } catch (error) {
    console.log(error);
  }

  const { stream, contentType } = await fetchTransactionData(txid);

  if (stream) {
    return { contentType, stream };
  }

  return {};
};

const cachePut = async (
  txid: string,
  data: Buffer | Readable,
  contentType: string | undefined
): Promise<void> => {
  await put("tx-data", `tx/${txid}`, data, {
    contentType,
  });
};

const getManifestSubpath = (requestPath: string): string | undefined => {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
};
