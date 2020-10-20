import { Readable, PassThrough, Transform, pipeline } from "stream";
import { promisify } from "util";

export const pipelineAsync = promisify(pipeline);

export const clone = () => {};

export const bufferToStream = (buffer: Buffer): Readable => {
  return new Readable({
    objectMode: false,
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
};

export const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  let buffer = Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    stream.once("end", () => {
      resolve(buffer);
    });

    stream.once("error", (error) => {
      reject(error);
    });

    stream.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    stream.once("readable", () => {
      stream.resume();
    });
  });
};

export const streamToString = async (stream: Readable): Promise<string> => {
  return (await streamToBuffer(stream)).toString("utf-8");
};

export const streamToJson = async <T = any>(stream: Readable): Promise<T> => {
  return JSON.parse(await streamToString(stream)) as T;
};

export const b64UrlDecodeStream = (readable: Readable): Readable => {
  const outputStream = new PassThrough({ objectMode: false });

  const decoder = new Base64UrlStreamDecoder();

  readable.pipe(decoder).pipe(outputStream);

  return outputStream;
};

export class Base64UrlStreamDecoder extends Transform {
  protected extra: string;
  protected bytesProcessed: number;

  constructor() {
    super({ decodeStrings: true, objectMode: false });
    this.extra = "";
    this.bytesProcessed = 0;
  }

  _transform(chunk: Buffer, encoding: any, cb: Function) {
    let conbinedChunk =
      this.extra +
      chunk
        .toString("utf8")
        .replace(/\-/g, "+")
        .replace(/\_/g, "/")
        .replace(/(\r\n|\n|\r)/gm, "");

    this.bytesProcessed += chunk.byteLength;

    const remaining = chunk.length % 4;

    this.extra = conbinedChunk.slice(chunk.length - remaining);

    const buf = Buffer.from(
      conbinedChunk.slice(0, chunk.length - remaining),
      "base64"
    );

    this.push(buf);
    cb();
  }

  _flush(cb: Function) {
    if (this.extra.length) {
      this.push(Buffer.from(this.extra, "base64"));
    }

    cb();
  }
}
