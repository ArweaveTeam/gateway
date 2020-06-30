import { base32 } from "rfc4648";
import { createHash } from "crypto";
import { Readable } from "stream";

export type Base64EncodedString = string;
export type Base64UrlEncodedString = string;
export type WinstonString = string;

export function toB64url(buffer: Buffer): Base64UrlEncodedString {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/\=/g, "");
}

export function fromB64Url(input: Base64UrlEncodedString): Buffer {
  const paddingLength = input.length % 4 == 0 ? 0 : 4 - (input.length % 4);

  const base64 = input
    .replace(/\-/g, "+")
    .replace(/\_/g, "/")
    .concat("=".repeat(paddingLength));

  return Buffer.from(base64, "base64");
}

export function fromB32(input: string): Buffer {
  return Buffer.from(
    base32.parse(input, {
      loose: true,
    })
  );
}

export function toB32(input: Buffer): string {
  return base32.stringify(input, { pad: false }).toLowerCase();
}

export function sha256B64Url(input: Buffer): string {
  return toB64url(createHash("sha256").update(input).digest());
}

export const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  let buffer = Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    stream.on("end", () => {
      resolve(buffer);
    });
    stream.on("close", () => {
      console.log("CLOSWE");
    });
  });
};

export const bufferToJson = (input: Buffer): any | undefined => {
  try {
    return JSON.parse(input.toString());
  } catch (error) {
    return undefined;
  }
};

export const streamToJson = async (input: Readable): Promise<any> => {
  return bufferToJson(await streamToBuffer(input));
};
