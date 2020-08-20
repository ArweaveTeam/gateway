import { fetchRequest } from "../../../lib/arweave";
import { RequestHandler } from "express";
import { BadGateway, NotFound, HttpError } from "http-errors";
import { get } from "../../../lib/redis";
import { streamToString } from "../../../lib/encoding";
import { Logger } from "winston";

interface CachedResponse {
  status: number;
  contentType: string;
  contentLength: number;
  body: string;
}

export const handler: RequestHandler = async (req, res) => {
  const { log, method, path } = req;

  req.log.info(`[proxy] request`, { method, path });

  const { status, contentType, contentLength, body } = await proxyAndCache(
    method,
    path.replace(/^\//, ""), // Remove slash prefix for node.net/info rather than node.net//info
    log
  );

  if (contentType) {
    res.type(contentType);
  }

  if (contentLength) {
    res.header("Content-Length", contentLength.toString());
  }

  res.status(status);

  return res.send(body);
};

const proxyAndCache = async (
  method: string,
  path: string,
  log: Logger
): Promise<CachedResponse> => {
  const cacheKey = `proxy/${method}/${path}`;

  return get<CachedResponse>(cacheKey, {
    ttl: 60 * 10, // Default to 10 mins, the block import job is responsible for purging the cache on each new block
    fetch: async (): Promise<any> => {
      log.info(`[proxy] cache miss`, { method, path });

      let nodeStatuses: number[] = [];

      const acceptableStatuses = [200, 202, 400, 410];

      const { status, headers, body } = await fetchRequest(
        path,
        ({ status }) => {
          nodeStatuses.push(status);
          return acceptableStatuses.includes(status);
        }
      );

      log.info(`[proxy] network response`, {
        method,
        path,
        status,
      });

      if (status && body && acceptableStatuses.includes(status)) {
        if (status == 400) {
          return {
            status,
            body: JSON.stringify({ status, error: await streamToString(body) }),
            contentType: "application/json",
          };
        }

        const streamedBody = await streamToString(body);
        const contentType = headers?.get("content-type") || undefined;
        const contentLength = Buffer.byteLength(streamedBody, "utf8");

        log.info(`[proxy] accepted network response headers`, {
          method,
          path,
          status,
          contentType,
          contentLength,
        });

        return {
          body: streamedBody,
          status,
          contentType,
          contentLength: contentLength,
        };
      }

      if (nodeStatuses.includes(404)) {
        throw new NotFound();
      }

      log.warn(`[proxy] no status or body response from nodes`, {
        status,
      });

      // This should only fire if a no response unexpected response is received
      // from all nodes, or no response is received at all.
      throw exposeError(new BadGateway());
    },
  });
};

const exposeError = (error: HttpError): HttpError => {
  error.expose = true;
  return error;
};
