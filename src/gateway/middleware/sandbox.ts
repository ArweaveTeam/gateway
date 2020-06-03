import { fromB64Url, toB32 } from "../../lib/encoding";
import { RequestHandler, Request } from "express";

const getTxIdFromPath = (path: string): string | undefined => {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
};

export const handler: RequestHandler = (req, res, next) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const currentSandbox = getRequestSandbox(req);
    const expectedSandbox = expectedTxSandbox(txid);

    if (currentSandbox != expectedSandbox) {
      return res.redirect(
        302,
        `${process.env.SANDBOX_PROTOCOL}://${expectedSandbox}.${process.env.SANDBOX_HOST}${req.path}`
      );
    }
  }

  next();
};

const expectedTxSandbox = (id: string): string => {
  return toB32(fromB64Url(id));
};

const getRequestSandbox = (req: Request) => {
  return req.headers.host!.split(".")[0].toLowerCase();
};
