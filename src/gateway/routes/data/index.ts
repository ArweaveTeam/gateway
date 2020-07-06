import { fetchTransactionData } from "../../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../../lib/arweave-path-manifest";
import { getStream, putStream, put } from "../../../lib/buckets";
import { RequestHandler, Request, Response } from "express";
import { streamToJson, jsonToBuffer } from "../../../lib/encoding";
import { Readable } from "stream";
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

        const manifest = await streamToJson<PathManifest>(stream);

        let cacheRequest: any = null;

        if (!cached) {
          cacheRequest = put("tx-data", `tx/${txid}`, jsonToBuffer(manifest), {
            contentType,
          });
        }

        return await Promise.all([
          cacheRequest,
          handleManifest(req, res, manifest, txid),
        ]);
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
  contentLength: number;
  stream: Readable;
  req: Request;
  res: Response;
}) => {
  await new Promise(async (resolve, reject) => {
    req.log.info("[get-data] fetching chunks to stream to user/cache", {
      txid,
    });
    let bytesStreamed = 0;

    const { upload, stream: cacheStream } = await putStream(
      "tx-data",
      `tx/${txid}`,
      {
        contentType,
        contentLength,
      }
    );

    cacheStream.on("error", (error) => {
      req.log.error("[get-data] cacheStream error", { error, txid });
    });

    stream.on("error", (error: any) => {
      req.log.error("[get-data] stream error", { error, txid });
      upload.abort();
      stream.destroy();
      cacheStream.destroy();
      reject(error);
    });

    stream.on("data", (chunk) => {
      req.log.info("[get-data] data stream is readable", {
        txid,
        bytesStreamed,
        contentLength,
        bytes: chunk.byteLength,
      });
      bytesStreamed += chunk.byteLength;

      cacheStream.write(chunk, (error) => {
        if (error) {
          reject(error);
        }
        res.write(chunk, () => {
          if (bytesStreamed >= contentLength) {
            cacheStream.end(() => {
              req.log.info("[get-data] closing cache stream", { txid });
              upload.send((error, data) => {
                req.log.info("[get-data] cache upload complete", {
                  error,
                  data,
                });
                if (error) {
                  reject(error);
                }
                resolve();
              });
            });
          }
        });
      });
    });
  });
  req.log.info("[get-data] streaming handler complete");
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

    if (stream && contentLength && contentLength > 0) {
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
    if (error.code != "NotFound") {
      req.log.error(error);
    }
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
