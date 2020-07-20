import { Transform } from "stream";

export class Base64DUrlecode extends Transform {
  protected extra: string;
  protected bytesProcessed: number;

  constructor() {
    super({ decodeStrings: false, objectMode: false });
    this.extra = "";
    this.bytesProcessed = 0;
  }

  _transform(chunk: Buffer, encoding: any, cb: Function) {
    let conbinedChunk =
      this.extra +
      chunk
        .toString("base64")
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
