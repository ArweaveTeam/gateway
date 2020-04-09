import { get } from "../../lib/buckets";
import { APIRequest, APIResponse, APIError } from "../../lib/api-handler";
import { redirectToSandbox } from "./middleware/sandbox";
import { PathPatterns } from ".";
/**
 * Handles requests for data on the magic gateway endpoint.
 *
 * Responsible for ensuring the correct sandboxed origins are used,
 * and redirects requests that aren't.
 *
 *
 * TODO:
 * Responsible for resolving path manifest URLs.
 */
export const handler = async (request: APIRequest, response: APIResponse) => {
  try {
    const txid = getTxIdFromPath(request.path);

    if (redirectToSandbox(request, response, { txid })) {
      return;
    }

    const data = await get("tx-data", `tx/${txid}`);

    if (data.ContentType) {
      response.type(data.ContentType);
    }

    if (data.Body) {
      response.sendStatus(200);
      response.sendFile(Buffer.from(data.Body));
    }
  } catch (error) {
    console.error(`get.error: ${error.message}`);
    return response.sendStatus(500);
  }
};

// If the request path starts with 43 characters that look
// like a valid arweaev txid, then extract and return that,
// otherwise, return null.
const getTxIdFromPath = (path: string): string => {
  const id = path.match(PathPatterns.extractTransactionId);
  if (id) {
    return id[1];
  }

  throw new APIError(404, "not found");
};
