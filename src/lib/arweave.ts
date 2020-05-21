import { Base64UrlEncodedString, fromB64Url, WinstonString } from "./encoding";
import AbortController from "abort-controller";
import fetch, {
  Headers as FetchHeaders,
  RequestInit as FetchRequestInit,
} from "node-fetch";

export type TransactionHeader = Omit<Transaction, "data">;

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

export const fetchBlock = async (id: string): Promise<Block> => {
  const endpoints = origins.map((host) => `${host}/block/hash/${id}`);

  const { body } = await getFirstResponse(
    endpoints,
    ({ status }) => status == 200
  );

  if (body) {
    const block = JSON.parse(body.toString());

    //For now we don't care about the poa and it's takes up too much
    // space when logged, so just remove it for now.
    //@ts-ignore
    delete block.poa;

    return block as Block;
  }

  throw new Error(`Failed to fetch block: ${id}`);
};

export const fetchTransactionHeader = async (
  txid: string
): Promise<TransactionHeader> => {
  const endpoints = origins.map((host) => `${host}/tx/${txid}`);

  const { body } = await getFirstResponse(
    endpoints,
    ({ status }) => status == 200
  );

  if (body) {
    return JSON.parse(body.toString()) as TransactionHeader;
  }

  throw new Error(`Failed to fetch transaction header: ${txid}`);
};

export const fetchTransactionData = async (
  txid: string
): Promise<{
  data: Buffer;
  contentType: string | undefined;
}> => {
  const endpoints = origins.map((host) => `${host}/${txid}`);

  const { headers, body } = await getFirstResponse(
    endpoints,
    ({ status }) => status == 200
  );

  if (headers && body) {
    return {
      data: body,
      contentType: headers.get("content-type") || undefined,
    };
  }
  throw new Error(`Failed to fetch transaction data: ${txid}`);
};

export const fetchRequest = async (
  endpoint: string,
  filter?: FilterFunction
): Promise<RequestResponse> => {
  const endpoints = origins.map((host) => `${host}/${endpoint}`);

  return await getFirstResponse(endpoints, filter);
};

export const getTagValue = (
  tx: TransactionHeader | Transaction,
  name: string
): string | undefined => {
  const contentTypeTag = tx.tags.find((tag) => {
    try {
      return (
        fromB64Url(tag.name).toString().toLowerCase() == name.toLowerCase()
      );
    } catch (error) {
      return false;
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

export const origins = JSON.parse(
  process.env.ARWEAVE_NODES || "null"
) as string[];

// if (!Array.isArray(origins)) {
//   throw new Error(
//     `error.config: Invalid env var, process.env.ARWEAVE_NODES: ${process.env.ARWEAVE_NODES}`
//   );
// }

interface RequestResponse {
  status?: number;
  headers?: FetchHeaders;
  body?: Buffer;
}

type FilterFunction = (options: {
  status: number;
  headers: FetchHeaders;
}) => boolean;

const getFirstResponse = async <T = any>(
  urls: string[],
  filter?: FilterFunction,
  options?: FetchRequestInit
): Promise<RequestResponse> => {
  const controllers: AbortController[] = [];

  const defaultFilter: FilterFunction = ({ status }) =>
    [200, 201, 202, 208].includes(status);

  return new Promise(async (resolve, reject) => {
    let isResolved = false;
    await Promise.all(
      urls.map(async (url, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 500));

        if (isResolved) {
          return;
        }

        const controller = new AbortController();
        controllers.push(controller);

        try {
          const response = await fetch(url, {
            ...(options || {}),
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
              body: await response.buffer(),
              status: response.status,
              headers: response.headers,
            });
          }
        } catch (error) {
          if (error.type != "aborted") {
            console.error(`Request error ${url}`, error);
          }
        }
      })
    );
    resolve({});
  });
};
