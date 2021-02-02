import Ar from 'arweave/node/ar';
import {base32} from 'rfc4648';
import {createHash} from 'crypto';
import {Readable, PassThrough, Transform} from 'stream';
import {Tag} from '../types/arweave.types';

const ar = new Ar();

export type Base64EncodedString = string;
export type Base64UrlEncodedString = string;
export type WinstonString = string;
export type ArString = string;
export type ISO8601DateTimeString = string;

export class Base64DUrlecode extends Transform {
    protected extra: string;
    protected bytesProcessed: number;

    constructor() {
      super({decodeStrings: false, objectMode: false});
      this.extra = '';
      this.bytesProcessed = 0;
    }

    _transform(chunk: Buffer, encoding: any, cb: Function) {
      const conbinedChunk =
        this.extra +
        chunk
            .toString('base64')
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .replace(/(\r\n|\n|\r)/gm, '');

      this.bytesProcessed += chunk.byteLength;

      const remaining = chunk.length % 4;

      this.extra = conbinedChunk.slice(chunk.length - remaining);

      const buf = Buffer.from(
          conbinedChunk.slice(0, chunk.length - remaining),
          'base64',
      );
      this.push(buf);
      cb();
    }

    _flush(cb: Function) {
      if (this.extra.length) {
        this.push(Buffer.from(this.extra, 'base64'));
      }

      cb();
    }
}

export const sha256 = (buffer: Buffer): Buffer => {
  return createHash('sha256').update(buffer).digest();
};

export function toB64url(buffer: Buffer): Base64UrlEncodedString {
  return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
}

export function fromB64Url(input: Base64UrlEncodedString): Buffer {
  const paddingLength = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);

  const base64 = input
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .concat('='.repeat(paddingLength));

  return Buffer.from(base64, 'base64');
}

export function fromB32(input: string): Buffer {
  return Buffer.from(
      base32.parse(input, {
        loose: true,
      }),
  );
}

export function toB32(input: Buffer): string {
  return base32.stringify(input, {pad: false}).toLowerCase();
}

export function sha256B64Url(input: Buffer): string {
  return toB64url(createHash('sha256').update(input).digest());
}

export const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  let buffer = Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    stream.on('end', () => {
      resolve(buffer);
    });
  });
};

export const streamToString = async (stream: Readable): Promise<string> => {
  return (await streamToBuffer(stream)).toString('utf-8');
};

export const bufferToJson = <T = any | undefined>(input: Buffer): T => {
  return JSON.parse(input.toString('utf8'));
};

export const jsonToBuffer = (input: object): Buffer => {
  return Buffer.from(JSON.stringify(input));
};

export const streamToJson = async <T = any | undefined>(input: Readable): Promise<T> => {
  return bufferToJson<T>(await streamToBuffer(input));
};

export const isValidUTF8 = function(buffer: Buffer) {
  return Buffer.compare(Buffer.from(buffer.toString(), 'utf8'), buffer) === 0;
};

export const streamDecoderb64url = (readable: Readable): Readable => {
  const outputStream = new PassThrough({objectMode: false});

  const decoder = new Base64DUrlecode();

  readable.pipe(decoder).pipe(outputStream);

  return outputStream;
};
export const bufferToStream = (buffer: Buffer) => {
  return new Readable({
    objectMode: false,
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
};

export const winstonToAr = (amount: string) => {
  return ar.winstonToAr(amount);
};

export const arToWinston = (amount: string) => {
  return ar.arToWinston(amount);
};

export const utf8DecodeTag = (
    tag: Tag,
): { name: string | undefined; value: string | undefined } => {
  let name;
  let value;
  try {
    const nameBuffer = fromB64Url(tag.name);
    if (isValidUTF8(nameBuffer)) {
      name = nameBuffer.toString('utf8');
    }
    const valueBuffer = fromB64Url(tag.value);
    if (isValidUTF8(valueBuffer)) {
      value = valueBuffer.toString('utf8');
    }
  } catch (error) {}
  return {
    name,
    value,
  };
};
