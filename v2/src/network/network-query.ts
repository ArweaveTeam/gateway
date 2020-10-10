import createError, { HttpError, isHttpError } from "http-errors";
import { fromB64Url } from "../lib/encoding";
import { log } from "../lib/log";
import { streamToJson } from "../lib/streams";
import { Tag, TransactionHeader } from "./interfaces";
import { Readable } from "stream";
import { request, Response } from "./peers";
import { getTagValue } from "./utils";
import createHttpError from "http-errors";

export async function getTransactionHeader(
  txid: string
): Promise<TransactionHeader> {
  log.info(`[arweave] fetching transaction header`, { txid });

  try {
    const response = await request(`tx/${txid}`);

    return streamToJson<TransactionHeader>(response.data);
  } catch (error) {
    if (isHttpError(error)) {
      if (error.statusCode == 502) {
        throw createError(404);
      }
    }
  }
  throw createError(502);
}

export interface DataResponse {
  stream?: Readable;
  contentLength: number;
  contentType?: string;
  tags?: Tag[];
}

const exposeError = (error: HttpError): HttpError => {
  error.expose = true;
  return error;
};

const fetch = async (path: string) => {
  let isPossible404 = false;
  try {
    const acceptableStatuses = [200, 202, 400, 410];

    return request(path, {
      timeout: 1000,
      validateStatus: (status) => {
        if (status == 404) {
          isPossible404 = true;
        }
        return acceptableStatuses.includes(status);
      },
    });
  } catch (error) {
    if (isPossible404) {
      throw createHttpError(404);
    }
    throw exposeError(createHttpError(502));
  }
};

export async function getTransactionData(
  txid: string
): Promise<{
  tags: Tag[];
  contentType?: string;
  stream: Readable;
}> {
  let possible404 = false;
  const [tagsResponse, dataResponse] = await Promise.all([
    request(`tx/${txid}/tags`),
    request(`tx/${txid}/data`, {
      validateStatus: (status) => {
        if (status == 404) {
          possible404 = true;
        }
        return [200, 400, 410].includes(status);
      },
    }),
  ]);

  const tags =
    tagsResponse && tagsResponse.data && tagsResponse.status == 200
      ? ((await streamToJson(tagsResponse.data)) as Tag[])
      : [];

  const contentType = getTagValue(tags, "content-type");

  if (dataResponse.status == 400) {
    const { error } = await streamToJson<{ error: string }>(dataResponse.data);

    if (error == "tx_data_too_big") {
      const offsetResponse = await request(`tx/${txid}/offset`);

      if (offsetResponse.data) {
        const { size, offset } = await streamToJson(offsetResponse.data);
        return {
          tags,
          contentType,
          //   contentLength: parseInt(size),
          stream: await streamChunks({
            size: parseInt(size),
            offset: parseInt(offset),
          }),
        };
      }
    }
  }

  if (dataResponse.status == 200) {
    return {
      tags,
      contentType,
      stream: dataResponse.data,
    };
  }

  throw createHttpError(502);
}

export const streamChunks = function ({
  offset,
  size,
}: {
  offset: number;
  size: number;
}): Readable {
  let bytesReceived = 0;
  let initialOffset = offset - size + 1;

  const stream = new Readable({
    autoDestroy: true,
    read: async function () {
      let next = initialOffset + bytesReceived;

      try {
        if (bytesReceived >= size) {
          this.push(null);
          return;
        }

        const { data } = await request(`chunk/${next}`);

        const chunk = fromB64Url((await streamToJson(data)).chunk);

        if (stream.destroyed) {
          return;
        }

        this.push(chunk);

        bytesReceived += chunk.byteLength;
      } catch (error) {
        console.error("stream error", error);
        stream.emit("error", error);
      }
    },
  });

  return stream;
};
