import createError, { isHttpError } from "http-errors";
import { fromB64Url } from "../lib/encoding";
import { log } from "../lib/log";
import { Transform } from "stream";
import { b64UrlDecodeStream, streamToJson } from "../lib/streams";
import { Tag, TransactionHeader } from "./interfaces";
import { Readable } from "stream";
import { getTagValue } from "./utils";
import createHttpError from "http-errors";
import {
  batchRequest,
  RequestOptions,
  BatchRequestOptions,
  Response,
} from "../lib/http";
import { getOnlineHosts } from "./nodes";
import { omit } from "lodash";
import { getCachedTransactionData, putCachedTransactionData } from "./cache";

const DEFAULT_HOSTS_REQUEST_COUNT = 4;
const DEFAULT_REQUEST_CONCURRENCY = 2;

export async function apiRequest(
  options: RequestOptions,
  batchOptions?: Partial<BatchRequestOptions>
): Promise<Response> {
  const flagPriority = [202, 410, 404];
  const flagCodes = [202, 404, 410];
  const flags: number[] = [];

  // console.log(options.endpoint, flagCodes);
  // console.log(options.endpoint, getOnlineHosts(DEFAULT_HOSTS_REQUEST_COUNT));

  try {
    return await batchRequest(
      {
        ...options,
        validateStatus: (status) => {
          // console.log(status);
          // We should set and test some some status flags along the way,
          // as we may get 202, 410, or 404 for tx data that hasn't been
          // fully propagetdd yet. This lets us return a better guestimate
          // for the status responses, e.g. no node returns the required 200
          // but one returned 202, then we should return 202 in the error handler.
          if (flagCodes.includes(status)) {
            flags.push(status);
          }

          return options.validateStatus
            ? options.validateStatus(status)
            : status == 200;
        },
      },
      {
        ...batchOptions,
        hosts:
          batchOptions?.hosts || getOnlineHosts(DEFAULT_HOSTS_REQUEST_COUNT),
        concurrency: batchOptions?.concurrency || DEFAULT_REQUEST_CONCURRENCY,
      }
    );
  } catch (error) {
    flagPriority.forEach((status) => {
      if (flags.includes(status)) {
        throw createError(status);
      }
    });

    throw createError(502);
  }
}

export async function getTransactionHeader(
  txid: string
): Promise<{ header: TransactionHeader }> {
  log.info(`[arweave] fetching transaction header`, { txid });

  const { data } = await apiRequest({
    endpoint: `tx/${txid}`,
  });

  const rawHeader = await streamToJson<TransactionHeader>(data);

  return {
    header: omit(
      { ...rawHeader, data_size: parseDataSize(rawHeader) },
      "data",
      "data_tree"
    ),
  };
}

const parseDataSize = (header: any): string => {
  // For v2 txs
  if (typeof header?.data_size == "string") {
    return header.data_size;
  }

  // For v1 txs
  if (typeof header?.data == "string" && header?.data?.length > 0) {
    return fromB64Url((header as any).data).byteLength.toFixed();
  }

  return "0";
};

export async function getTransactionData(
  txid: string
): Promise<{
  contentType?: string;
  contentLength: number;
  data: Readable;
}> {
  try {
    const {
      stream,
      contentType,
      contentLength,
    } = await getCachedTransactionData(txid);

    return { data: stream, contentType, contentLength };
  } catch (error) {
    if (isHttpError(error) && error.status == 404) {
      const { data, contentType, contentLength } = await fetchTransactionData(
        txid
      );

      const { stream: cacheStream } = await putCachedTransactionData(txid, {
        contentType,
      });

      const responseStream = new Readable({
        autoDestroy: true,
        read() {},
      });

      data
        .on("data", (chunk) => {
          cacheStream.write(chunk, () => {
            responseStream.push(chunk);
          });
        })
        .on("end", () => {
          cacheStream.end(() => {
            responseStream.push(null);
          });
        })
        .on("error", (error) => {
          data.destroy();
          cacheStream.end(() => {
            responseStream.push(null);
          });
        })
        .resume();

      return { data: responseStream, contentType, contentLength };
    } else {
      throw error;
    }
  }
}

const fetchTransactionData = async (
  txid: string,
  { useCache = true }: { useCache?: boolean } = {}
): Promise<{
  contentType?: string;
  contentLength: number;
  data: Readable;
  cached: boolean;
}> => {
  const [{ header }, { data, status }] = await Promise.all([
    getTransactionHeader(txid),
    apiRequest({
      endpoint: `tx/${txid}/data`,
      validateStatus: (status) => [200, 400].includes(status),
    }),
  ]);

  const { tags } = header;

  const contentType = getTagValue(tags, "content-type");
  const contentLength = parseInt(header.data_size);

  if (status == 200) {
    return {
      contentType,
      contentLength,
      cached: false,
      data: b64UrlDecodeStream(data),
    };
  }

  if (status == 400) {
    const { error } = await streamToJson<{ error: string }>(data);

    if (error == "tx_data_too_big") {
      const { data: offsetData } = await apiRequest({
        endpoint: `tx/${txid}/offset`,
      });

      const { size, offset } = await streamToJson(offsetData);

      return {
        contentType,
        contentLength,
        cached: false,
        data: await fetchChunkDataStream({
          size: parseInt(size),
          offset: parseInt(offset),
        }),
      };
    }
  }

  // This sould never fire as we have our acceptable status codes
  // in validateStatus, but we'll throw just to be safe, and for TS typings.
  throw createHttpError(status || 502);
};

const fetchChunkDataStream = function ({
  offset,
  size,
}: {
  offset: number;
  size: number;
}): Readable {
  let bytesReceived = 0;
  const initialOffset = offset - size + 1;

  return new Readable({
    autoDestroy: true,
    read: async function () {
      const next = initialOffset + bytesReceived;

      try {
        if (bytesReceived >= size) {
          this.push(null);
          return;
        }

        const { data } = await apiRequest(
          { endpoint: `chunk/${next}`, timeout: 2000 },
          { concurrency: 1 }
        );

        const chunk = fromB64Url((await streamToJson(data)).chunk);

        if (this.destroyed) {
          return;
        }

        this.push(chunk);

        bytesReceived += chunk.byteLength;
      } catch (error) {
        this.emit("error", error);
      }
    },
  });
};
