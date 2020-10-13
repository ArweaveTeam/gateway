import createError from "http-errors";
import { fromB64Url } from "../lib/encoding";
import { log } from "../lib/log";
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

const DEFAULT_HOSTS_REQUEST_COUNT = 4;
const DEFAULT_REQUEST_CONCURRENCY = 2;

export async function apiRequest(
  options: RequestOptions,
  batchOptions?: Partial<BatchRequestOptions>
): Promise<Response> {
  const flags: { [key: number]: boolean } = {
    202: false,
    404: false,
    410: false,
  };

  const flagCodes = Object.keys(flags).map(parseInt);

  console.log(options.endpoint, getOnlineHosts(DEFAULT_HOSTS_REQUEST_COUNT));

  try {
    return await batchRequest(
      {
        ...options,
        validateStatus: (status) => {
          // We should set and test some some status flags along the way,
          // as we may get 202, 410, or 404 for tx data that hasn't been
          // fully propagetdd yet. This lets us return a better guestimate
          // for the status responses, e.g. no node returns the required 200
          // but one returned 202, then we should return 202 in the error handler.
          if (flagCodes.includes(status)) {
            flags[status] = true;
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
    console.error(error);
    if (flags[202]) {
      throw createError(202);
    }
    if (flags[410]) {
      throw createError(410);
    }
    if (flags[404]) {
      throw createError(404);
    }
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

  return {
    header: omit(
      await streamToJson<TransactionHeader>(data),
      "data",
      "data_tree"
    ),
  };
}

export async function getTransactionData(
  txid: string
): Promise<{
  tags: Tag[];
  contentType?: string;
  contentLength: number;
  data: Readable;
}> {
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
      tags,
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
        tags,
        data: await getChunkDataStream({
          size: parseInt(size),
          offset: parseInt(offset),
        }),
      };
    }
  }

  // This sould never fire as we have our acceptable status codes
  // in validateStatus, but we'll throw just to be safe, and for TS typings.
  throw createHttpError(502);
}

const getChunkDataStream = function ({
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
        console.error("stream error", error);
        this.emit("error", error);
      }
    },
  });
};
