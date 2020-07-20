import { fetchRequest } from "../../../lib/arweave";
import { RequestHandler } from "express";
import createError from "http-errors";

export const handler: RequestHandler = async (req, res) => {
  req.log.info(`[proxy] request`, { method: req.method, path: req.path });

  const { status, headers, body } = await fetchRequest(
    req.path,
    ({ status }) => {
      return [200, 202, 400, 410].includes(status);
    }
  );

  if (status && body && headers) {
    const contentType = headers.get("content-type");
    const contentLength = headers.get("content-length");

    req.log.info(`[proxy] response`, {
      status,
      headers,
      contentLength,
      contentType,
    });

    if (contentType) {
      res.type(contentType);
    }
    res.status(status);

    return body.pipe(res);
  }

  req.log.info(`[proxy] response`, { status, headers });

  throw new createError.NotFound();
};
