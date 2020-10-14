import { Express } from "express";
import { handler as dataHandler, matchAnyDataPathRegex } from "./handlers/data";
import { handler as proxyHandler } from "./handlers/proxy";
import { corsHandler } from "./middleware/cors";
import { errorHandler } from "./middleware/error";
import { jsonHandler } from "./middleware/json";
import {
  sentryErrorHandler,
  sentryRequestHandler,
  sentryTraceHandler,
} from "./middleware/sentry";

export const router = (app: Express): Express => {
  middleware(app);

  routes(app);

  errorHandlers(app);

  return app;
};

const middleware = (app: Express) => {
  app.use(sentryRequestHandler);
  app.use(sentryTraceHandler);
  app.use(corsHandler);
  app.use(jsonHandler);
};

const routes = (app: Express) => {
  app.get(matchAnyDataPathRegex, dataHandler);
  app.get("*", proxyHandler);
};

const errorHandlers = (app: Express) => {
  app.use(sentryErrorHandler);
  app.use(errorHandler);
};
