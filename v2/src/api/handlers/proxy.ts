import { RequestHandler } from "express";
import createHttpError, { HttpError } from "http-errors";
import { streamToString } from "../../lib/streams";
import { Logger } from "winston";
import { request } from "../../network/peers";
interface CachedResponse {
  status: number;
  contentType?: string;
  contentLength?: number;
  body?: string;
}

export const handler: RequestHandler = async (req, res) => {
  const { method, path } = req;

  console.info(`[proxy] request`, { method, path });

  const { status, contentType, contentLength, body } = await proxyAndCache(
    method,
    path.replace(/^\//, "") // Remove slash prefix for node.net/info rather than node.net//info
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
  log?: Logger
): Promise<CachedResponse> => {
  let nodeStatuses: number[] = [];

  const { status, data, headers } = await fetch(path);

  if (status.toString().startsWith("4")) {
    let errorResponse = JSON.stringify({
      status,
      error: await streamToString(data),
    });

    return {
      status,
      body: errorResponse,
      contentType: "application/json",
      contentLength: Buffer.from(errorResponse).byteLength,
    };
  }

  const streamedBody = await streamToString(data);
  const contentLength = Buffer.byteLength(streamedBody, "utf8");

  return {
    body: streamedBody,
    status,
    contentType: undefined,
    contentLength,
  };
};

const exposeError = (error: HttpError): HttpError => {
  error.expose = true;
  return error;
};

const fetch = async (path: string) => {
  let isPossible404 = false;
  try {
    const acceptableStatuses = [200, 202, 400, 410];

    return request(path, {
      timeout: 1000,
      validateStatus: (status) => {
        if (status == 404) {
          isPossible404 = true;
        }
        return acceptableStatuses.includes(status);
      },
    });
  } catch (error) {
    if (isPossible404) {
      throw createHttpError(404);
    }
    throw exposeError(createHttpError(502));
  }
};
