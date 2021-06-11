import express from "express";
import helmet from "helmet";
import {
  initConnectionPool,
  releaseConnectionPool,
} from "../database/postgres";
import log from "../lib/log";
import { handler as corsMiddleware } from "./middleware/cors";
import {
  errorResponseHandler,
  notFoundHandler,
  sentryCaptureRequestHandler,
  sentryReportErrorHandler,
} from "./middleware/error";
import { handler as jsonBodyMiddleware } from "./middleware/json-body";
import {
  configureRequestLogging,
  handler as requestLoggingMiddleware,
} from "./middleware/request-log";
import { handler as sandboxMiddleware } from "./middleware/sandbox";
import { handler as arqlHandler } from "./routes/arql";
import { handler as dataHandler } from "./routes/data";
import { apolloServer } from "./routes/graphql";
import { apolloServer as apolloServerV2 } from "./routes/graphql-v2";
import { handler as healthHandler } from "./routes/health";
import { handler as newTxHandler } from "./routes/new-tx";
import { handler as newChunkHandler } from "./routes/new-chunk";
import { handler as proxyHandler } from "./routes/proxy";
import { handler as webhookHandler } from "./routes/webhooks";

import { logMiddleware } from './middleware/log.middleware';

import JoinKoi from 'koi-logs';

import cron from 'node-cron';

require("express-async-errors");

initConnectionPool("read", { min: 1, max: 100 });

const app = express();

const dataPathRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;

const port = process.env.APP_PORT;

app.set("trust proxy", 1);

// Global middleware

app.use(configureRequestLogging);

app.use(sentryCaptureRequestHandler);

app.use(requestLoggingMiddleware);

app.use(helmet.hidePoweredBy());

app.use(corsMiddleware);

app.use(sandboxMiddleware);
app.use(logMiddleware);

new JoinKoi('/usr/app/logs');

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.options("/tx", (req, res) => {
  res.send("OK").end();
});

app.post("/tx", jsonBodyMiddleware, newTxHandler);

app.post("/chunk", jsonBodyMiddleware, newChunkHandler);

app.options("/chunk", (req, res) => {
  res.send("OK").end();
});

app.post("/webhook", jsonBodyMiddleware, webhookHandler);

app.post("/arql", jsonBodyMiddleware, arqlHandler);

app.post("/arql", jsonBodyMiddleware, arqlHandler);

// The apollo middleare *must* be applied after the standard arql handler
// as arql is the default behaviour. If the graphql handler
// is invoked first it will emit an error if it received an arql request.
apolloServer().applyMiddleware({ app, path: "/arql" });

apolloServerV2({ introspection: true, playground: true }).applyMiddleware({
  app,
  path: "/graphql",
});

app.get("/health", healthHandler);

app.get(dataPathRegex, dataHandler);

app.get("*", proxyHandler);

// Error handlers

app.use(notFoundHandler);

app.use(sentryReportErrorHandler);

app.use(errorResponseHandler);

const server = app.listen(port, () => {
  log.info(`[app] Started on http://localhost:${port}`);
  require('child_process').exec('git rev-parse HEAD', function(err: any, stdout: any) {
    console.log('Last commit hash on this branch is:', stdout);
  });
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

// console.log([server.headersTimeout]);

process.on("SIGINT", function () {
  log.info("\nGracefully shutting down from SIGINT");
  releaseConnectionPool().then(() => {
    log.info("[app] DB connections closed");
    process.exit(1);
  });
});
