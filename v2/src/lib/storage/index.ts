import { Readable, Writable } from "stream";
import { LocalStorageDriver } from "./driver/local-driver";

const driver = new LocalStorageDriver({
  basePath: "/Users/kyle/repos/gateway/v2",
});

export type GetObjectStream = (key: string) => Promise<GetObjectStreamResponse>;
export type PutObjectStream = (
  key: string,
  options?: PutObjectStreamOptions
) => Promise<PutObjectStreamResponse>;

export interface StorageDriver {
  putObjectStream: PutObjectStream;
  getObjectStream: GetObjectStream;
}

export interface GetObjectStreamResponse {
  stream: Readable;
  contentType?: string;
}
export interface PutObjectStreamOptions {
  contentType?: string;
}

export interface PutObjectStreamResponse {
  stream: Writable;
}

export const getObjectStream: GetObjectStream = (key) => {
  return driver.getObjectStream(normalizeKey(key));
};

export const putObjectStream: PutObjectStream = (key, options) => {
  return driver.putObjectStream(normalizeKey(key), options);
};

const normalizeKey = (key: string): string => {
  const prefix = process.env.STORAGE_KEY_PREFIX;
  return `${prefix}/${key}`;
};
