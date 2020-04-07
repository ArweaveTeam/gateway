import API from "lambda-api";
import { createApiHandler } from "../../lib/api-handler";
import { handler as proxyHandler } from "./proxy";
import { handler as dataHandler } from "./data";

const api = API();

export const PathPatterns = {
  isDataPath: /^\/?([a-z0-9-_]{43})\/?$|^\/?([a-z0-9-_]{43})\/(.*)$/i,
  extractTransactionId: /^\/?([a-z0-9-_]{43})/i,
};

api.get(
  "*",
  createApiHandler(async (request, response) => {
    if (request.path.match(PathPatterns.isDataPath)) {
      console.log("view..");
      return dataHandler(request, response);
    }

    return proxyHandler(request, response);
  })
);

export const handler = async (event: any, context: any) => {
  return api.run(event, context);
};
