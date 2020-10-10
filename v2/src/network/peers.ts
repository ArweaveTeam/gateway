import { log } from "../lib/log";
import { shuffle, orderBy } from "lodash";
import axios, { AxiosResponse } from "axios";
import { performance } from "perf_hooks";
import { streamToJson } from "../lib/streams";
import { Readable } from "stream";
import createError from "http-errors";
import { isAxiosError } from "./utils";

const joinNodes = [
  //   "http://localhost:3000/",
  "http://lon-1.eu-west-1.arweave.net:1984",
  "http://lon-2.eu-west-1.arweave.net:1984",
  "http://lon-3.eu-west-1.arweave.net:1984",
  "http://lon-4.eu-west-1.arweave.net:1984",
  "http://lon-5.eu-west-1.arweave.net:1984",
  "http://lon-6.eu-west-1.arweave.net:1984",
];

let nodes = joinNodes.map((host) => {
  return {
    host,
    online: true,
    responseTime: 0,
    info: null as any,
  };
});

let running = false;

export function getNodes() {
  return nodes;
}

export function start() {
  if (!running) {
    const func = async () => {
      console.log("Testing nodes...", nodes);
      nodes = orderBy(
        await Promise.all(
          getNodes().map(async (node) => {
            try {
              const response = await request("info", {
                hosts: [node.host],
                timeout: 1000,
              });
              return {
                ...node,
                online:
                  (response?.duration || 0) > 0 && response?.status == 200,
                duration: response?.duration || 0,
                info: await streamToJson(response?.data),
              };
            } catch (error) {
              return {
                ...node,
                online: false,
                info: null,
              };
            }
          })
        ),
        ["online", "data.info.height", "duration"],
        ["desc", "desc", "asc"]
      );
      console.log("Updating nodes...", nodes);
    };
    func();
    setInterval(func, 30000);
  }

  running = true;
}

interface RequestOptions {
  method?: "GET" | "POST";
  headers?: { [key: string]: string | number };
  body?: any;
  timeout?: number;
  timeoutBackoff?: boolean;
  validateStatus?: (status: number) => boolean;
  hosts?: string[];
}

export interface Response extends AxiosResponse<Readable> {
  duration: number;
  contentType: string;
}

export async function request(
  endpoint: string,
  {
    method = "GET",
    headers = {},
    timeout = 100,
    timeoutBackoff = true,
    validateStatus,
    hosts,
  }: RequestOptions = {}
): Promise<Response> {
  const nodes = hosts || getNodes().map(({ host }) => host);

  let attempts = 0;

  while (attempts < 5) {
    attempts++;

    for (let index = 0; index < nodes.length; index++) {
      const host = nodes[index];

      console.log(`${host}/${endpoint}`);

      try {
        const start = performance.now();
        const response = await axios.request<any, AxiosResponse<Readable>>({
          url: `${host}/${endpoint}`,
          method,
          headers,
          timeout: timeoutBackoff ? timeout * attempts + 1 : timeout,
          responseType: "stream",
          validateStatus,
        });

        const end = performance.now();

        return {
          ...response,
          duration: end - start,
          contentType: response.headers["content-type"],
        };
      } catch (error) {
        console.error(`${host} - ${error.message}`);
        if (isAxiosError(error)) {
        }
      }
    }
  }

  throw createError(502);
}
