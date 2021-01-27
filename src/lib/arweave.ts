import AbortController from "abort-controller";
import { NotFound } from "http-errors";
import { shuffle } from "lodash";
import fetch, {
  Headers as FetchHeaders,
  RequestInit as FetchRequestInit,
} from "node-fetch";
import { Readable } from "stream";
import log from "../lib/log";
import {
  Base64UrlEncodedString,
  bufferToStream,
  fromB64Url,
  isValidUTF8,
  streamToBuffer,
  streamToJson,
  WinstonString,
} from "./encoding";

import { Tag as ArTag } from './arweave.transaction';

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

export interface DataBundleWrapper {
  items: DataBundleItem[];
}

export interface DataBundleItem {
  owner: string;
  target: string;
  nonce: string;
  tags: Tag[];
  data: Base64UrlEncodedString;
  signature: string;
  id: string;
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
  contentLength: number;
  contentType?: string;
  tags?: Tag[];
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

const getContentLength = (headers: any): number => {
  return parseInt(headers.get("content-length"));
};

export const fetchTransactionData = async (
  txid: string
): Promise<DataResponse> => {
  log.info(`[arweave] fetching data and tags`, { txid });

  try {
    const [tagsResponse, dataResponse] = await Promise.all([
      fetchRequest(`tx/${txid}/tags`, ({ status }) => status == 200),
      fetchRequest(`tx/${txid}/data`, ({ status, headers }) => {
        return [200, 400].includes(status) && getContentLength(headers) > 0;
      }),
    ]);

    const tags =
      tagsResponse && tagsResponse.body && tagsResponse.status == 200
        ? ((await streamToJson(tagsResponse.body)) as Tag[])
        : [];

    const contentType = getTagValue(tags, "content-type");

    if (dataResponse.body) {
      if (dataResponse.status == 200) {
        const content = fromB64Url(
          (await streamToBuffer(dataResponse.body)).toString()
        );

        return {
          tags,
          contentType,
          contentLength: content.byteLength,
          stream: bufferToStream(content),
        };
      }

      if (dataResponse.status == 400) {
        const { error } = await streamToJson<{ error: string }>(
          dataResponse.body
        );

        if (error == "tx_data_too_big") {
          const offsetResponse = await fetchRequest(`tx/${txid}/offset`);

          if (offsetResponse.body) {
            const { size, offset } = await streamToJson(offsetResponse.body);
            return {
              tags,
              contentType,
              contentLength: parseInt(size),
              stream: await streamChunks({
                size: parseInt(size),
                offset: parseInt(offset),
              }),
            };
          }
        }
      }
    }

    log.info(`[arweave] failed to find tx`, { txid });
  } catch (error) {
    log.error(`[arweave] error finding tx`, { txid, error: error.message });
  }

  return { contentLength: 0 };
};

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

        const { body } = await fetchRequest(
          `chunk/${next}`,
          ({ status }) => status == 200
        );

        if (body) {
          const data = fromB64Url((await streamToJson(body)).chunk);

          if (stream.destroyed) {
            return;
          }

          this.push(data);

          bytesReceived += data.byteLength;
        }
      } catch (error) {
        console.error("stream error", error);
        stream.emit("error", error);
      }
    },
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
  const endpoints = origins.map(
    // Replace any starting slashes
    (host) => `${host}/${endpoint.replace(/^\//, "")}`
  );

  return await getFirstResponse(endpoints, filter, { stream: true });
};

export const getTagValue = (tags: Tag[] | Array<ArTag>, name: string): string | undefined => {
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

  return new Promise(async (resolve) => {
    let isResolved = false;
    await Promise.all(
      shuffle(urls).map(async (url, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 500));

        if (isResolved) {
          return;
        }

        log.info(`[proxy] requesting`, { url });

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
