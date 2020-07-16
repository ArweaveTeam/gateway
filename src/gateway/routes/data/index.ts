import { fetchTransactionData, getTagValue, Tag } from "../../../lib/arweave";
import {
  resolveManifestPath,
  PathManifest,
} from "../../../lib/arweave-path-manifest";
import { getExtension } from "mime";
import { getStream, putStream, put, get } from "../../../lib/buckets";
import { RequestHandler, Request, Response } from "express";
import { streamToJson, jsonToBuffer, fromB64Url } from "../../../lib/encoding";
import { Readable } from "stream";
import { NotFound } from "http-errors";
import { query } from "../../../database/transaction-db";
import { query as queryChunks } from "../../../database/chunk-db";
import { getConnectionPool } from "../../../database/postgres";
import { StreamTap } from "../../../lib/stream-tap";
import pump from "pump";

const DEFAULT_TYPE = "text/html";

interface Bundle {
  items: { id: string; data: string; tags: Tag[] }[];
}

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
            tags,
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
          const bundle = await streamToJson<Bundle>(stream);

          if (bundle && bundle.items) {
            let cacheRequest: any = null;

            if (!cached) {
              cacheRequest = put(
                "tx-data",
                `tx/${txid}`,
                jsonToBuffer(bundle),
                {
                  contentType,
                  tags,
                }
              );
            }

            return await Promise.all([
              cacheRequest,
              handleBundle({
                req,
                res,
                bundle,
                txid,
                contentType,
                contentLength,
              }),
            ]);
          }
        }
      }

      setDataHeaders({ contentType, contentLength, etag: txid, res });

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
  etag,
  contentType,
  contentLength,
}: {
  res: Response;
  etag: string;
  contentType?: string;
  contentLength?: number;
}) => {
  res.header("Etag", etag);
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
    req.log.info("[get-data] streaming chunks from s3 cache", {
      txid,
    });

    const { upload, stream: cacheStream } = await putStream(
      "tx-data",
      `tx/${txid}`,
      {
        contentType,
        contentLength,
        tags,
      }
    );

    const copyToResponse = new StreamTap(res);

    cacheStream.on("end", (error: any) => {
      req.log.info("[get-data] cach stream ended", { txid, error });

      if (copyToResponse.getBytesProcessed() != contentLength) {
        req.log.warn(
          `[get-data] cached content doesn't match expected data_size`,
          { contentLength, processedBytes: copyToResponse.getBytesProcessed }
        );
      }

      upload.send((err, data) => {
        req.log.info("[get-data] s3 upload done", { data });
        if (err) {
          upload.abort();
          reject(err);
        }
        resolve(data);
      });
    });

    res.flushHeaders();

    pump(stream, copyToResponse, cacheStream, async (err) => {
      if (err) {
        req.log.error("pump error", { err });
        upload.abort();
        res.end();
        cacheStream.end();
        stream.destroy();
        console.log("rejecting...");
        reject(err);
      }
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

    setDataHeaders({ contentType, contentLength, etag: txid, res });

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

const handleBundle = async ({
  req,
  res,
  contentType,
  contentLength,
  bundle,
  txid,
}: {
  req: Request;
  res: Response;
  contentType: string;
  contentLength: number;
  bundle: Bundle;
  txid: string;
}) => {
  const subpath = (getTransactionSubpath(req.path) || "").replace(/\//g, "");

  req.log.info("[get-data] parsing data bundle", {
    txid,
    subpath,
    bundle: {
      contentLength,
      items: bundle && bundle.items && bundle.items.length,
    },
  });

  if (subpath) {
    const item = bundle.items.find(({ id }) => subpath == id);

    if (item) {
      req.log.info("[get-data] matched bundle item", { txid, subpath });

      const data = fromB64Url(item.data);
      const contentType = getTagValue(item.tags, "content-type");
      const contentLength = data.byteLength;

      setDataHeaders({ contentType, contentLength, etag: subpath, res });

      const extension = contentType && getExtension(contentType);

      if (extension) {
        res.header(
          "Content-Disposition",
          `inline;filename=${subpath}.${extension}`
        );
      }

      return res.send(data);
    }

    throw new NotFound();
  }

  setDataHeaders({ contentType, contentLength, etag: txid, res });

  res.send(JSON.stringify(bundle));
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
    req.log.info("[get-data] searching for tx: s3 tx cache");
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
    req.log.info("[get-data] searching for tx: s3 chunk cache");
    const pool = getConnectionPool("read");

    const [txHeader] = await query(pool, {
      id: txid,
      limit: 1,
      select: ["data_root", "data_size", "content_type"],
    });

    if (txHeader && txHeader.data_root && txHeader.data_size > 0) {
      const contentType = txHeader.content_type || undefined;
      const contentLength = parseInt(txHeader.data_size);
      const chunks = (await queryChunks(pool, {
        select: ["offset", "chunk_size"],
        order: "asc",
      }).where({ data_root: txHeader.data_root })) as {
        offset: number;
        chunk_size: number;
      }[];

      const cachedChunksSum = chunks.reduce(
        (carry, { chunk_size }) => carry + (chunk_size || 0),
        0
      );

      const hasAllChunks = cachedChunksSum == contentLength;

      req.log.warn(`[get-data] cached chunks do not equal tx data_size`, {
        cachedChunksSum,
        contentLength,
        hasAllChunks,
      });

      if (hasAllChunks) {
        const { stream } = await streamCachedChunks({
          offsets: chunks.map((chunk) => chunk.offset),
          root: txHeader.data_root,
        });

        if (stream) {
          return {
            stream,
            contentType,
            contentLength,
          };
        }
      }
    }
  } catch (error) {
    req.log.error(error);
  }

  try {
    req.log.info("[get-data] searching for tx: arweave nodes");
    const {
      stream,
      contentType,
      contentLength,
      tags,
    } = await fetchTransactionData(txid);

    if (stream) {
      return {
        contentType,
        contentLength,
        stream,
        tags,
      };
    }
  } catch (error) {
    req.log.error(error);
  }

  throw new NotFound();
};

export const streamCachedChunks = async ({
  root,
  offsets,
}: {
  root: string;
  offsets: number[];
}): Promise<{
  stream: Readable;
}> => {
  let index = 0;

  const stream = new Readable({
    autoDestroy: true,
    read: async function () {
      try {
        const offset = offsets[index];

        if (!offset) {
          this.push(null);
          return;
        }

        const { Body } = await get("tx-data", `chunks/${root}/${offset}`);

        if (Body) {
          index = index + 1;
          this.push(Body);
          return;
        }

        throw new NotFound();
      } catch (error) {
        this.emit("error", error);
        this.destroy();
      }
    },
  });

  return {
    stream,
  };
};

//@deprecated
const getManifestSubpath = (requestPath: string): string | undefined => {
  return getTransactionSubpath(requestPath);
};

const getTransactionSubpath = (requestPath: string): string | undefined => {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
};
