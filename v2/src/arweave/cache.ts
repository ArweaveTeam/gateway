import {
  GetObjectStream,
  PutObjectStream,
  PutObjectStreamOptions,
  StorageDriver,
} from "../lib/storage/interface";

const config: {
  prefix?: string;
  driver?: StorageDriver;
} = {};

export const configureCache: {
  driver?: StorageDriver;
  prefix: string;
} = { prefix: process.env.STORAGE_KEY_PREFIX! };

export async function getCachedTransactionData(txid: string) {
  return await getStorageDriver().getObjectStream(`tx/${txid}`);
}

export async function putCachedTransactionData(
  txid: string,
  options: PutObjectStreamOptions
) {
  return getStorageDriver().putObjectStream(`tx/${txid}`, options);
}

export const getObjectStream: GetObjectStream = (key) => {
  return getStorageDriver().getObjectStream(normalizeKey(key));
};

export const putObjectStream: PutObjectStream = (key, options) => {
  return getStorageDriver().putObjectStream(normalizeKey(key), options);
};

export const getStorageDriver = (): StorageDriver => {
  if (config.driver) {
    return config.driver;
  }

  throw new Error(`arweave/cache storage driver not configured`);
};

export const setStorageDriver = (driver: StorageDriver): void => {
  config.driver = driver;
};

const normalizeKey = (key: string): string => {
  const prefix = config.prefix;
  return `${prefix}/${key}`;
};
