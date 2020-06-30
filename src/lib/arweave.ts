import {
  Base64UrlEncodedString,
  fromB64Url,
  WinstonString,
  bufferToJson,
  streamToBuffer,
  streamToJson,
} from "./encoding";
import AbortController from "abort-controller";
import fetch, {
  Headers as FetchHeaders,
  RequestInit as FetchRequestInit,
  Response as FetchResponse,
} from "node-fetch";
import { shuffle } from "lodash";
import log from "../lib/log";
import { NotFound } from "http-errors";
import { Readable, PassThrough } from "stream";
import { Base64DUrlecode } from "./base64-stream";

export type TransactionHeader = Omit<Transaction, "data">;

export type TransactionData = {
  data: Buffer;
  contentType: string | undefined;
};

export interface Transaction {
  format: number;
  id: string;
  signature: string;
  owner: string;
  target: string;
  data: Base64UrlEncodedString;
  reward: WinstonString;
  last_tx: string;
  tags: Tag[];
  quantity: WinstonString;
  data_size: number;
  data_root: string;
  data_tree: string[];
}

export interface Chunk {
  data_root: string;
  data_size: number;
  data_path: string;
  chunk: string;
  offset: number;
}

export type ChunkHeader = Omit<Chunk, "chunk">;

export interface Tag {
  name: Base64UrlEncodedString;
  value: Base64UrlEncodedString;
}

export interface Block {
  nonce: string;
  previous_block: string;
  timestamp: number;
  last_retarget: number;
  diff: string;
  height: number;
  hash: string;
  indep_hash: string;
  txs: string[];
  tx_root: string;
  wallet_list: string;
  reward_addr: string;
  reward_pool: number;
  weave_size: number;
  block_size: number;
  cumulative_diff: string;
  hash_list_merkle: string;
}

export interface DataResponse {
  stream?: Readable;
  contentType: string | undefined;
}

export const origins = JSON.parse(
  process.env.ARWEAVE_NODES || "null"
) as string[];

export const fetchBlock = async (id: string): Promise<Block> => {
  const endpoints = origins.map((host) => `${host}/block/hash/${id}`);

  const { body } = await getFirstResponse(
    endpoints,
    ({ status }) => status == 200
  );

  if (body) {
    const block = await streamToJson(body);

    //For now we don't care about the poa and it's takes up too much
    // space when logged, so just remove it for now.
    //@ts-ignore
    delete block.poa;

    return block as Block;
  }

  throw new Error(`Failed to fetch block: ${id}`);
};

export const fetchBlockByHeight = async (height: string): Promise<Block> => {
  log.info(`[arweave] fetching block by height`, { height });

  const endpoints = origins.map((host) => `${host}/block/height/${height}`);

  const { body } = await getFirstResponse(
    endpoints,
    ({ status }) => status == 200
  );

  if (body) {
    const block = await streamToJson(body);

    //For now we don't care about the poa and it's takes up too much
    // space when logged, so just remove it for now.
    //@ts-ignore
    delete block.poa;

    return block as Block;
  }

  throw new Error(`Failed to fetch block: ${height}`);
};

export const fetchTransactionHeader = async (
  txid: string
): Promise<TransactionHeader> => {
  log.info(`[arweave] fetching transaction header`, { txid });
  const endpoints = origins.map((host) => `${host}/tx/${txid}`);

  const { body } = await getFirstResponse(
    endpoints,
    ({ status }) => status == 200
  );

  if (body) {
    return (await streamToJson(body)) as TransactionHeader;
  }

  throw new NotFound();
};

export const fetchTransactionData = async (
  txid: string
): Promise<DataResponse> => {
  log.info(`[arweave] fetching data and tags`, { txid });

  try {
    const [tagsResponse, dataResponse] = await Promise.all([
      fetchRequest(`tx/${txid}/tags`, ({ status }) => status == 200),
      fetchRequest(`tx/${txid}/data`, ({ status, headers }) => {
        if ([200, 400].includes(status)) {
          console.log(headers.get("content-length"));
          return parseInt(headers.get("content-length") || "0") > 0;
        }
        return false;
      }),
    ]);

    const tags =
      tagsResponse && tagsResponse.body
        ? ((await streamToJson(tagsResponse.body)) as Tag[])
        : [];

    const contentType = getTagValue(tags, "content-type");

    if (dataResponse.status == 200 && dataResponse.body) {
      const outputStream = new PassThrough();

      const decoder = new Base64DUrlecode();

      dataResponse.body.pipe(decoder).pipe(outputStream);

      return {
        contentType,
        stream: outputStream,
      };
    }

    if (dataResponse.body) {
      if (dataResponse.status == 400) {
        const { error } = await streamToJson(dataResponse.body);

        if (error == "tx_data_too_big") {
          const offsetResponse = await fetchRequest(`tx/${txid}/offset`);

          if (offsetResponse.body) {
            const { size, offset } = await streamToJson(offsetResponse.body);
            return {
              contentType,
              stream: await streamChunks({ size, offset }),
            };
          }
        }
      }

      if (dataResponse.status == 200) {
        return {
          contentType,
          stream,
          data: fromB64Url(dataResponse.body!.toString("utf8")),
        };
      }
    }

    log.info(`[arweave] failed to find tx`, { txid });

    // if (dataResponse.body) {
    //   log.info(`[arweave] found tx`, { txid, type: contentType });
    //   // return {
    //   //   contentType,
    //   //   stream,
    //   //   data: fromB64Url(dataResponse.body!.toString("utf8")),
    //   // };
    // } else {
    //   const [dataSize, offset] = await Promise.all([
    //     fetchRequest(`tx/${txid}/data_size`, ({ status }) => status == 200),
    //     fetchRequest(`tx/${txid}/offset`, ({ status }) => status == 200),
    //   ]);

    //   log.info(`[arweave] failed to find tx`, { txid });
    // }
  } catch (error) {
    log.error(`[arweave] error finding tx`, { txid, error: error.message });
  }

  throw new NotFound();
};

export const streamChunks = function ({
  offset,
  size,
}: {
  offset: number;
  size: number;
}): Readable {
  let bytesReceived = 0;
  let i = 0;

  const stream = new Readable({
    read: async function () {
      try {
        if (bytesReceived >= size) {
          this.push(null);
        }

        const { body } = await fetchRequest(
          `chunk/${offset - bytesReceived}`,
          ({ status }) => status == 200
        );

        if (body) {
          const chunk = await streamToJson(body);

          const data = fromB64Url(chunk.chunk);

          if (stream.destroyed) {
            return;
          }

          this.push(data);

          bytesReceived += data.byteLength;

          log.info("bytesReceived", {
            bytesReceived,
            mbReceived: bytesReceived / 1024 / 1024,
            size: size / 1024 / 1024,
          });
        }
      } catch (error) {
        console.error(error);
        stream.emit("error", error);
      }
    },
    autoDestroy: true,
    highWaterMark: 1024 * 1024 * 10,
  });

  return stream;
};

export const fetchRequest = async (
  endpoint: string,
  filter?: FilterFunction
): Promise<RequestResponse> => {
  const endpoints = origins.map((host) => `${host}/${endpoint}`);

  return await getFirstResponse(endpoints, filter);
};

export const streamRequest = async (
  endpoint: string,
  filter?: FilterFunction
): Promise<RequestResponse> => {
  const endpoints = origins.map((host) => `${host}/${endpoint}`);

  return await getFirstResponse(endpoints, filter, { stream: true });
};

export const getTagValue = (tags: Tag[], name: string): string | undefined => {
  const contentTypeTag = tags.find((tag) => {
    try {
      return (
        fromB64Url(tag.name).toString().toLowerCase() == name.toLowerCase()
      );
    } catch (error) {
      return undefined;
    }
  });
  try {
    return contentTypeTag
      ? fromB64Url(contentTypeTag.value).toString()
      : undefined;
  } catch (error) {
    return undefined;
  }
};

function isValidUTF8(buffer: Buffer) {
  return Buffer.compare(Buffer.from(buffer.toString(), "utf8"), buffer) === 0;
}

export const utf8DecodeTag = (
  tag: Tag
): { name: string | undefined; value: string | undefined } => {
  let name = undefined;
  let value = undefined;
  try {
    const nameBuffer = fromB64Url(tag.name);
    if (isValidUTF8(nameBuffer)) {
      name = nameBuffer.toString("utf8");
    }
    const valueBuffer = fromB64Url(tag.value);
    if (isValidUTF8(valueBuffer)) {
      value = valueBuffer.toString("utf8");
    }
  } catch (error) {}
  return {
    name,
    value,
  };
};

interface RequestResponse {
  status?: number;
  headers?: FetchHeaders;
  body?: Readable;
}

type FilterFunction = (options: {
  status: number;
  headers: FetchHeaders;
  error?: any;
}) => boolean;

const getFirstResponse = async <T = any>(
  urls: string[],
  filter?: FilterFunction,
  options?: {
    stream?: boolean;
    fetch?: FetchRequestInit;
  }
): Promise<RequestResponse> => {
  const controllers: AbortController[] = [];

  const defaultFilter: FilterFunction = ({ status }) =>
    [200, 201, 202, 208].includes(status);

  return new Promise(async (resolve, reject) => {
    let isResolved = false;
    await Promise.all(
      shuffle(urls).map(async (url, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 500));

        if (isResolved) {
          return;
        }

        const controller = new AbortController();
        controllers.push(controller);

        try {
          const response = await fetch(url, {
            ...((options && options.fetch) || {}),
            signal: controller.signal,
          });

          if (
            filter
              ? filter({ status: response.status, headers: response.headers })
              : defaultFilter({
                  status: response.status,
                  headers: response.headers,
                })
          ) {
            isResolved = true;
            controllers.forEach((requestController) => {
              if (requestController != controller) {
                requestController.abort();
              }
            });
            resolve({
              body: response.body as Readable,
              status: response.status,
              headers: response.headers,
            });
          }
        } catch (error) {
          if (error.type != "aborted") {
            log.warn(`[arweave] request error`, {
              message: error.message,
              url,
            });
          }
        }
      })
    );
    resolve({});
  });
};
