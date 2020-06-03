import { fetchRequest } from "../../../lib/arweave";
import { RequestHandler } from "express";
import createError from "http-errors";

export const handler: RequestHandler = async (req, res) => {
  req.log.info(`[proxy] request`, { method: req.method, path: req.path });

  const { status, headers, body } = await fetchRequest(req.path, ({ status }) =>
    [200, 202, 410].includes(status)
  );

  if (status && body && headers) {
    const contentType = headers.get("content-type") || "text/plain";

    req.log.info(`[proxy] response`, {
      status,
      headers,
      length: body && body?.byteLength,
      type: contentType,
    });

    if (contentType) {
      res.type(contentType);
    }
    return res.status(status).send(body);
  }

  req.log.info(`[proxy] response`, { status, headers });

  throw new createError.NotFound();
};
