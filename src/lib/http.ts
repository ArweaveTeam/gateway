import http from "http";
import { inspect } from "util";
import fetch, { Response } from "node-fetch";
export interface HttpResponse {
  statusCode: number | null;
  contentType: string | null;
  data: Buffer;
}

export async function get(url: string): Promise<Response> {
  console.log(`Requesting: ${url}`);
  return fetch(url, { redirect: "manual", follow: 0 });
}
