import { fetchTransactionData, getTagValue, Tag } from "../../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../../lib/arweave-path-manifest";
import {
  getStream,
  putStream,
  put,
  // get,
  // objectHeader,
} from "../../../lib/buckets";
import { RequestHandler, Request, Response } from "express";
import { streamToJson, jsonToBuffer } from "../../../lib/encoding";
import { Readable } from "stream";
import { NotFound } from "http-errors";
// import { query } from "../../../database/transaction-db";
// import { getConnectionPool } from "../../../database/postgres";

const DEFAULT_TYPE = "text/html";

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const { stream, contentType, contentLength, tags, cached } = await getData(
      txid,
      req
    );

    req.log.info("tx stream", {
      stream: stream && stream?.readable,
      contentType,
      contentLength,
      cached,
      tags,
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

      if (tags) {
        if (
          contentType == "application/json" &&
          getTagValue(tags, "bundle-format") == "json" &&
          getTagValue(tags, "bundle-version") == "1.0.0"
        ) {
          // Parse data here
        }
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
          tags,
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
  tags,
  stream,
  res,
  req,
}: {
  txid: string;
  contentType?: string;
  contentLength: number;
  tags?: Tag[];
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
        tags,
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
  tags?: Tag[];
}> => {
  try {
    req.log.info("Trying cache");
    const { stream, contentType, contentLength, tags } = await getStream(
      "tx-data",
      `tx/${txid}`
    );
    if (stream) {
      return {
        stream,
        contentType,
        contentLength,
        tags,
        cached: true,
      };
    }
  } catch (error) {
    if (error.code != "NotFound") {
      req.log.error(error);
    }
  }
  try {
    req.log.info("Trying network");
    const {
      stream,
      contentType,
      contentLength,
      tags,
    } = await fetchTransactionData(txid);

    if (stream) {
      return { contentType, contentLength, stream, tags };
    }
  } catch (error) {
    req.log.error(error);
  }

  throw new NotFound();

  // console.log("Trying chunk cache");

  // const pool = getConnectionPool("read");

  // const [txHeader] = await query(pool, {
  //   id: txid,
  //   limit: 1,
  //   select: ["data_root", "data_size", "content_type"],
  // });

  // console.log({ txHeader });

  // if (txHeader) {
  //   const { stream } = await streamCachedChunks({
  //     root: txHeader.data_root,
  //     contentLength: txHeader.data_size,
  //   });

  //   if (stream) {
  //     return {
  //       stream,
  //       contentType: txHeader.content_type,
  //       contentLength: txHeader.data_size,
  //     };
  //   }
  // }

  // console.log("No matches!");

  // throw new NotFound();
};

// export const streamCachedChunks = async ({
//   root,
//   contentLength,
// }: {
//   root: string;
//   contentLength: number;
// }): Promise<{
//   stream: Readable;
// }> => {
//   let offset = 0;

//   const { contentType, contentLength: chunkContentLength } = await objectHeader(
//     "tx-data",
//     `chunks/${root}/0`
//   );

//   if (chunkContentLength < 1) {
//     throw new NotFound();
//   }

//   const stream = new Readable({
//     autoDestroy: true,
//     read: async function () {
//       try {
//         if (offset >= contentLength) {
//           this.push(null);
//           return;
//         }

//         const { Body } = await get(
//           "tx-data",
//           `chunks/${root}/${Math.max(offset, -1, 0)}`
//         );

//         if (Buffer.isBuffer(Body)) {
//           if (stream.destroyed) {
//             return;
//           }

//           this.push(Body);

//           offset += Body.byteLength;
//         } else {
//           this.push(null);
//         }
//       } catch (error) {
//         console.error("stream error", error);
//         stream.emit("error", error);
//       }
//     },
//   });

//   return {
//     stream,
//   };
// };

const getManifestSubpath = (requestPath: string): string | undefined => {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
};
