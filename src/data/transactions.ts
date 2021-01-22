import { Logger } from "winston";
import {
  fetchTransactionData,
  getTagValue,
  Tag,
  DataBundleWrapper,
} from "../lib/arweave";
import { Readable } from "stream";
import { getStream, putStream, put, get, objectHeader } from "../lib/buckets";
import { query as queryChunks } from "../database/chunk-db";
import { query as transactionsQuery } from "../database/transaction.query";
import { getConnectionPool } from "../database/postgres";
import { NotFound } from "http-errors";
import Knex from "knex";
import { streamToJson, bufferToStream, fromB64Url } from "../lib/encoding";
import { b64UrlDecode } from "arweave/node/lib/utils";

interface DataStream {
  stream?: Readable;
  contentType?: string;
  contentLength?: number;
  cached?: boolean;
  tags?: Tag[];
}

export const getData = async (
  txid: string,
  { log }: { log: Logger }
): Promise<DataStream> => {
  log.info("[get-data] searching for tx: s3 tx cache");
  const s3CacheResponse = await streamCachedData({ txid });

  if (s3CacheResponse) {
    return s3CacheResponse;
  }

  const connection = getConnectionPool("read");

  const [txHeader] = await transactionsQuery(connection, {
    id: txid,
    limit: 1,
    select: ["data_root", "data_size", "content_type", "parent"],
  });

  console.log({ txHeader });

  try {
    if (txHeader && txHeader.data_size > 0 && txHeader.parent) {
      log.info(`[get-data] item is data bundle item, searching for parent tx`, {
        txid,
        parent: txHeader.parent,
      });
      const parent = await getData(txHeader.parent, { log });
      if (parent.stream) {
        log.info(`[get-data] item is data bundle item, found parent tx`, {
          txid,
          parent: txHeader.parent,
        });
        const parentData = await streamToJson<DataBundleWrapper>(parent.stream);
        const item = parentData.items.find((item) => {
          return item.id == txid;
        });

        if (item) {
          const data = fromB64Url(item.data);
          return {
            stream: bufferToStream(data),
            contentType: getTagValue(item.tags, "content-type"),
            contentLength: data.byteLength,
          };
        }
      }
    }

    log.info("[get-data] searching for tx: s3 chunk cache");

    if (txHeader && txHeader.data_root && txHeader.data_size > 0) {
      const contentType = txHeader.content_type || undefined;
      const contentLength = parseInt(txHeader.data_size);

      const chunks = (await queryChunks(connection, {
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

      log.warn(`[get-data] cached chunks do not equal tx data_size`, {
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
    log.error(error);
  }

  try {
    log.info("[get-data] searching for tx: arweave nodes");
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
    log.error(error);
  }

  throw new NotFound();
};

export const streamCachedData = async ({
  txid,
}: {
  txid: string;
}): Promise<DataStream | undefined> => {
  try {
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
      console.warn(error);
      throw new NotFound();
    }
  }
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

  // will throw an error if the first chunk doesn't exist
  await objectHeader("tx-data", `chunks/${root}/${offsets[0]}`);

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
