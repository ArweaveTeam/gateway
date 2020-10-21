import { Readable } from "stream";
import {
  GetObjectStream,
  PutObjectStream,
  PutObjectStreamOptions,
  StorageDriver,
} from "../lib/storage";

const config: {
  prefix?: string;
  driver?: StorageDriver;
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
  return getStorageDriver().getObjectStream(key);
};

export const putObjectStream: PutObjectStream = (key, options) => {
  return getStorageDriver().putObjectStream(key, options);
};

export const getStorageDriver = (): StorageDriver => {
  if (config.driver) {
    return config.driver;
  }

  throw new Error(`arweave/cache storage driver not configured`);
};

export const streamToCache = async (
  cacheKey: string,
  streamLoader: () => Promise<{
    contentType?: string;
    contentLength: number;
    data: Readable;
  }>
): Promise<{
  contentType?: string;
  contentLength: number;
  data: Readable;
}> => {
  const { data, contentType, contentLength } = await streamLoader();

  const { stream: cacheStream } = await putObjectStream(cacheKey, {
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
};

export const setStorageDriver = (driver: StorageDriver): void => {
  config.driver = driver;
};
