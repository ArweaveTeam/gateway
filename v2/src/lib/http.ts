import axios, { AxiosResponse } from "axios";
import plimit from "p-limit";
import Bluebird from "bluebird";
import { Readable } from "stream";
import { performance } from "perf_hooks";
import { isAxiosError } from "../network/utils";

interface RequestOptions {
  method?: "GET" | "POST";
  endpoint: string;
  headers?: { [key: string]: string | number };
  data?: any;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
}

interface BatchRequestOptions {
  hosts: string[];
  concurrency?: number;
}

interface Response extends AxiosResponse<Readable> {
  duration: number;
  contentType: string;
}

export const request = async ({
  method = "GET",
  endpoint,
  headers = {},
  timeout = 5000,
  validateStatus,
  data,
}: RequestOptions): Promise<Response> => {
  const start = performance.now();

  const response = await axios.request<any, AxiosResponse<Readable>>({
    method,
    url: endpoint,
    headers,
    timeout,
    data,
    responseType: "stream",
    validateStatus,
  });

  const end = performance.now();

  return {
    ...response,
    duration: end - start,
    contentType: response.headers["content-type"],
  };
};

export const batchRequest = async (
  requestOptions: RequestOptions,
  { hosts, concurrency = 2 }: BatchRequestOptions
): Promise<Response> => {
  const nodes = hosts;

  const defer = plimit(concurrency);

  return await Bluebird.any(
    nodes.map((host) =>
      defer(async () => {
        try {
          return request(requestOptions).then((response) => {
            // If we have a valid response we must clear the queue to
            // prevent other queued requests from executing.
            defer.clearQueue();
            return response;
          });
        } catch (error) {
          // We just want to log errors and not suppress them, otherwise
          // Bluebird.any will think the request was successful and resolve to an empty response.
          // Bluebird.any will catch errors and push them into an AggregateError which will
          // be throw if *all* requets fail.
          if (isAxiosError(error) && !(error.response?.status == 404)) {
            console.error(`${host} - ${error.message}`);
          }

          throw error;
        }
      })
    )
  );
};
