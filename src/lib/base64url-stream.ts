import { Transform } from "stream";

export class Base64DUrlecode extends Transform {
  protected extra: string;

  constructor() {
    super({ decodeStrings: false });
    this.extra = "";
  }

  _transform(chunk: Buffer | string, encoding: any, cb: Function) {
    chunk = "" + chunk;

    chunk =
      this.extra +
      chunk
        .replace(/\-/g, "+")
        .replace(/\_/g, "/")
        .replace(/(\r\n|\n|\r)/gm, "");

    const remaining = chunk.length % 4;

    this.extra = chunk.slice(chunk.length - remaining);
    chunk = chunk.slice(0, chunk.length - remaining);

    const buf = Buffer.from(chunk, "base64");
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
