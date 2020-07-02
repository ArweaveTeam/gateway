import { fetchTransactionData } from "../../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../../lib/arweave-path-manifest";
import { getStream, putStream } from "../../../lib/buckets";
import { RequestHandler, Request, Response } from "express";
import { streamToJson } from "../../../lib/encoding";
import { Readable, PassThrough } from "stream";
import { NotFound } from "http-errors";

const DEFAULT_TYPE = "text/html";

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const { stream, contentType, contentLength, cached } = await getData(
      txid,
      req
    );

    req.log.info("tx stream", {
      stream: stream && stream?.readable,
      contentType,
      contentLength,
      cached,
    });

    if (stream && contentLength) {
      if (contentType == "application/x.arweave-manifest+json") {
        req.log.info("[get-data] manifest content-type detected", { txid });

        return handleManifest(req, res, await streamToJson(stream), txid);
      }

      setDataHeaders({ contentType, contentLength, txid, res });

      if (cached) {
        stream.pipe(res);
      } else {
        await sendAndCache({
          txid,
          req,
          res,
          stream,
          contentType,
          contentLength,
        });
      }
    }
  }
};

const getTxIdFromPath = (path: string): string | undefined => {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
};

const setDataHeaders = ({
  res,
  txid,
  contentType,
  contentLength,
}: {
  res: Response;
  txid: string;
  contentType?: string;
  contentLength?: number;
}) => {
  res.header("Etag", txid);
  if (contentType) {
    res.type(contentType || DEFAULT_TYPE);
  }
  if (contentLength) {
    res.header("Content-Length", contentLength.toString());
  }
};

const sendAndCache = async ({
  txid,
  contentType,
  contentLength,
  stream,
  res,
  req,
}: {
  txid: string;
  contentType: undefined | string;
  contentLength: undefined | number;
  stream: Readable;
  req: Request;
  res: Response;
}) => {
  await new Promise(async (resolve, reject) => {
    req.log.info("[data] fetching chunks to stream to user/cache", { txid });
    let bytesStreamed = 0;

    const cacheStream = new PassThrough({
      objectMode: false,
      autoDestroy: true,
    });

    const { upload } = await putStream("tx-data", `tx/${txid}`, cacheStream, {
      contentType,
      contentLength,
    });

    stream.on("readable", async () => {
      let chunk: Buffer;

      while ((chunk = stream.read())) {
        bytesStreamed += chunk.byteLength;
        cacheStream.write(chunk);
        res.write(chunk);
      }
    });

    stream.on("end", async () => {
      req.log.info("[data] end of chunk stream", { txid });
      cacheStream.end();
    });

    stream.on("error", (err: any) => {
      req.log.warn(err, { txid });
      upload.abort();
      stream.destroy();
      cacheStream.destroy();
      reject(err);
    });

    cacheStream.on("end", async () => {
      req.log.info("[data] end of cache stream", { txid });
      await upload.promise();
      req.log.info("[data] cache uploadc complete", { txid });
      resolve();
    });
  }).catch((error) => {
    req.sentry.captureEvent(error);
  });
};
const handleManifest = async (
  req: Request,
  res: Response,
  manifest: PathManifest,
  txid: string
) => {
  const subpath = getManifestSubpath(req.path);

  if (req.path == `/${txid}`) {
    return res.redirect(301, `${req.path}/`);
  }

  const resolvedTx = resolveManifestPath(manifest, subpath);

  req.log.info("[get-data] resolved manifest path content", {
    subpath,
    resolvedTx,
  });

  if (resolvedTx) {
    const { stream, contentType, contentLength, cached } = await getData(
      resolvedTx,
      req
    );

    setDataHeaders({ contentType, contentLength, txid, res });

    if (stream) {
      if (cached) {
        return stream.pipe(res);
      } else {
        return sendAndCache({
          txid: resolvedTx,
          req,
          res,
          stream,
          contentType,
          contentLength,
        });
      }
    }
  }

  throw new NotFound();
};

const getData = async (
  txid: string,
  req: Request
): Promise<{
  stream?: Readable;
  contentType?: string;
  contentLength?: number;
  cached?: boolean;
  size?: number;
}> => {
  try {
    const { stream, contentType, contentLength } = await getStream(
      "tx-data",
      `tx/${txid}`
    );
    if (stream) {
      return {
        stream,
        contentType,
        contentLength,
        cached: true,
      };
    }
  } catch (error) {
    req.log.error(error);
  }
  try {
    const { stream, contentType, contentLength } = await fetchTransactionData(
      txid
    );

    if (stream) {
      return { contentType, contentLength, stream };
    }
  } catch (error) {
    req.log.error(error);
    throw new NotFound();
  }

  throw new NotFound();
};

const getManifestSubpath = (requestPath: string): string | undefined => {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
};
