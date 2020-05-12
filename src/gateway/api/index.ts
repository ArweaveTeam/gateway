import {
  createRouter,
  createApiHandler,
  bindApiHandler,
} from "../../lib/api-handler";
import { handler as proxyHandler } from "./proxy";
import { handler as dataHandler } from "./data";

export const PathPatterns = {
  extractManifestSubpath: /^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i,
  isDataPath: /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i,
  extractTransactionId: /^\/?([a-z0-9-_]{43})/i,
};

const router = createRouter();

bindApiHandler(
  router,
  createApiHandler(async (request, response) => {
    if (request.path.match(PathPatterns.isDataPath)) {
      return dataHandler(request, response);
    }

    return proxyHandler(request, response);
  })
);

export const handler = async (event: any, context: any) => {
  return router.run(event, context);
};
