import { createRouter } from "../../lib/api-handler";
import { handler as proxyHandler } from "./proxy";
import { handler as dataHandler } from "./data";
import { redirectToSandbox } from "./middleware/sandbox";

const PathPatterns = {
  isDataPath: /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i,
  extractTransactionId: /^\/?([a-z0-9-_]{43})/i,
};

const router = createRouter();

router.use(redirectToSandbox);

router.get(async (request, response) => {
  if (isDataPath(request.path)) {
    return dataHandler(request, response);
  }

  return proxyHandler(request, response);
});

export const handler = async (event: any, context: any) => {
  return router.run(event, context);
};

// If the request path starts with 43 characters that look
// like a valid arweave txid, then extract and return that,
// otherwise, return null.
export const getTxIdFromPath = (path: string): string | undefined => {
  const matches = path.match(PathPatterns.extractTransactionId) || [];
  return matches[1];
};

const isDataPath = (path: string): boolean => {
  return !!path.match(PathPatterns.isDataPath);
};
