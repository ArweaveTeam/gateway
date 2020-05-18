import { APIRequest, APIResponse } from "../../../lib/api-handler";
import { fromB64Url, toB32 } from "../../../lib/encoding";
import { Middleware } from "lambda-api";
import { getTxIdFromPath } from "..";

export const redirectToSandbox: Middleware = (
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
      // Default to http as this works in dev environments and any/all
      // load balancers/gateways in deployed settings should pass the
      // protocol using the x-forwarded-proto header.
      const protocol = request.headers["x-forwarded-proto"] || "https";

      // Note! This will not work with TLDs with periods, e.g. .co.uk
      const [host, tld] = request.headers.host!.split(".").slice(-2);

      return response.redirect(
        302,
        `${protocol}://${expectedSandbox}.${host}.${tld}${request.path}`
      );
    }
  }

  next();
};

const expectedTxSandbox = (id: string): string => {
  return toB32(fromB64Url(id));
};

const getRequestSandbox = (request: APIRequest) => {
  if (process.env.IS_LOCAL) {
    // 'b32sub.arweave.net'.split('.') => ['b32sub', 'arweave', 'net'] => [0] => 'b32sub'
    // 'arweave.net'.split('.') => ['arweave', 'net'] => [0] => 'arweave'
    return request.headers.host!.split(".").slice(-3)[0].toLowerCase();
  }
  // This is simply given to us by API gateway in deployed environments.
  //https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
  return request.requestContext.domainPrefix!.toLowerCase();
};
