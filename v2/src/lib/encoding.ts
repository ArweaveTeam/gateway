import { base32 } from "rfc4648";
import { createHash } from "crypto";

import Ar from "arweave/node/ar";

const ar = new Ar();

export type Base64EncodedString = string;
export type Base64UrlEncodedString = string;
export type WinstonString = string;
export type ArString = string;
export type ISO8601DateTimeString = string;

export const sha256 = (buffer: Buffer): Buffer => {
  return createHash("sha256").update(buffer).digest();
};

export function toB64Url(buffer: Buffer): Base64UrlEncodedString {
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

export function toB32(input: Buffer): string {
  return base32.stringify(input, { pad: false }).toLowerCase();
}

export function fromB32(input: string): Buffer {
  return Buffer.from(
    base32.parse(input, {
      loose: true,
    })
  );
}

export function sha256B64Url(input: Buffer): string {
  return toB64Url(createHash("sha256").update(input).digest());
}

export const jsonToBuffer = (input: object): Buffer => {
  return Buffer.from(JSON.stringify(input));
};

export const bufferToJson = <T = any | undefined>(input: Buffer): T => {
  return JSON.parse(input.toString("utf8"));
};

export const isValidUTF8 = function (buffer: Buffer) {
  return Buffer.compare(Buffer.from(buffer.toString(), "utf8"), buffer) === 0;
};

export const winstonToAr = (amount: string) => {
  return ar.winstonToAr(amount);
};

export const arToWinston = (amount: string) => {
  return ar.arToWinston(amount);
};
