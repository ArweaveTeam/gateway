import { fetchRequest } from "../../../lib/arweave";
import { RequestHandler } from "express";
import { BadGateway, NotFound, HttpError } from "http-errors";
import { streamToString } from "../../../lib/encoding";
import { Logger } from "winston";

interface CachedResponse {
  status: number;
  contentType?: string;
  contentLength?: number;
  body?: string;
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

  res.status(status);

  return res.send(body).end();
};

const proxyAndCache = async (
  method: string,
  path: string,
  log: Logger
): Promise<CachedResponse> => {
  let nodeStatuses: number[] = [];

  const acceptableStatuses = [200, 202, 400, 410];

  const { status, headers, body } = await fetchRequest(path, ({ status }) => {
    nodeStatuses.push(status);
    return acceptableStatuses.includes(status);
  });

  if (status && body && acceptableStatuses.includes(status)) {
    if (status.toString().startsWith("4")) {
      let errorResponse = JSON.stringify({
        status,
        error: await streamToString(body),
      });
      return {
        status,
        body: errorResponse,
        contentType: "application/json",
        contentLength: Buffer.from(errorResponse).byteLength,
      };
    }

    const streamedBody = await streamToString(body);
    const contentType = headers?.get("content-type") || undefined;
    const contentLength = Buffer.byteLength(streamedBody, "utf8");

    return {
      body: streamedBody,
      status,
      contentType,
      contentLength,
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
};

const exposeError = (error: HttpError): HttpError => {
  error.expose = true;
  return error;
};
