import { Express } from "express";
import { handler as dataHandler, matchAnyDataPathRegex } from "./handlers/data";
import { handler as proxyHandler } from "./handlers/proxy";
import { handler as webhookHandler } from "./handlers/webhooks";
import { corsHandler } from "./middleware/cors";
import { errorHandler } from "./middleware/error";
import { jsonHandler } from "./middleware/json";
import { requestLogHandler } from "./middleware/request-log";
import {
  sentryErrorHandler,
  sentryRequestHandler,
  sentryTraceHandler,
} from "./middleware/sentry";
import { webhookAuthHandler } from "./middleware/webhook-token-auth";

export const router = (app: Express): Express => {
  middleware(app);

  routes(app);

  errorHandlers(app);

  return app;
};

const middleware = (app: Express) => {
  app.use(sentryRequestHandler);
  app.use(sentryTraceHandler);
  app.use(requestLogHandler);
  app.use(corsHandler);
  app.use(jsonHandler);
};

const routes = (app: Express) => {
  app.get(/^\/?favicon/, (req, res) => res.sendStatus(204));

  app.post("/webhook", webhookAuthHandler, webhookHandler);

  app.get(matchAnyDataPathRegex, dataHandler);
  app.get("*", proxyHandler);
};

const errorHandlers = (app: Express) => {
  app.use(sentryErrorHandler);
  app.use(errorHandler);
};
