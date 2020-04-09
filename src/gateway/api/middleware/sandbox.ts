import { APIRequest, APIResponse, APIError } from "../../../lib/api-handler";
import { fromB64Url, toB32 } from "../../../lib/encoding";

export const redirectToSandbox = (
  request: APIRequest,
  response: APIResponse,
  { txid }: { txid: string }
): boolean => {
  const currentSandbox = getRequestSandbox(request);
  const expectedSandbox = expectedTxSandbox(txid);

  if (currentSandbox == expectedSandbox) {
    // No redirect is required, so do nothing.
    return false;
  }

  /**
   * In a local dev environment we don't have an API gateway
   * mapping the requests to a service stage, so we need to
   * manually add the stage back into the request path.
   * In production we don't want this though.
   * Prod > arweave.dev/info
   * Dev > arweave.local/dev/info
   */
  const redirectPath = process.env.IS_LOCAL
    ? `/${request.requestContext.stage}${request.path}`
    : request.path;

  // Default to http as this works in dev environments and any/all
  // load balancers/gateways in deployed settings should pass the
  // protocol using the x-forwarded-proto header.
  const protocol = request.headers["x-forwarded-proto"] || "http";

  // Note! This will not work with TLDs with periods, e.g. .co.uk
  const [host, tld] = request.headers.host!.split(".").slice(-2);
  response.redirect(
    302,
    `${protocol}://${expectedSandbox}.${host}.${tld}${redirectPath}`
  );

  // We redirected the request, so return true.
  return true;
};

const expectedTxSandbox = (id: string): string => {
  return toB32(fromB64Url(id));
};

const getRequestSandbox = (request: APIRequest) => {
  if (process.env.IS_LOCAL) {
    return (request.headers.host!.split(".").slice(-3)[0] || "").toLowerCase();
  }
  // This is simply given to us by API gateway in deployed environments.
  //https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
  return request.requestContext.domainPrefix!.toLowerCase();
};
