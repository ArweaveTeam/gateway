import { fromB64Url, toB32 } from "../../lib/encoding";
import { RequestHandler, Request } from "express";

const getTxIdFromPath = (path: string): string | undefined => {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
};

export const redirectToSandbox: RequestHandler = (
  request,
  response,
  next: Function
) => {
  const txid = getTxIdFromPath(request.path);

  if (txid) {
    console.log(`sandbox for ${txid}`);
    const currentSandbox = getRequestSandbox(request);
    const expectedSandbox = expectedTxSandbox(txid);

    if (currentSandbox != expectedSandbox) {
      return response.redirect(
        302,
        `${process.env.SANDBOX_PROTOCOL}://${expectedSandbox}.${process.env.SANDBOX_HOST}${request.path}`
      );
    }
  }

  next();
};

const expectedTxSandbox = (id: string): string => {
  return toB32(fromB64Url(id));
};

const getRequestSandbox = (request: Request) => {
  return request.headers.host!.split(".")[0].toLowerCase();
};
