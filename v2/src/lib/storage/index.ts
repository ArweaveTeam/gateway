import { Readable, Writable } from "stream";

export type GetObjectStream = (key: string) => Promise<GetObjectStreamResponse>;

export type PutObjectStream = (
  key: string,
  options?: PutObjectStreamOptions
) => Promise<PutObjectStreamResponse>;
export interface StorageDriver {
  getObjectStream: GetObjectStream;
  putObjectStream: PutObjectStream;
}

export interface GetObjectStreamResponse {
  stream: Readable;
  contentType?: string;
  contentLength: number;
}
export interface PutObjectStreamOptions {
  contentType?: string;
  contentLength?: number;
}

export interface PutObjectStreamResponse {
  stream: Writable;
}
