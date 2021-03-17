import express from "express";
import { Request, Response, NextFunction, RequestHandler } from 'express';
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
import fs from 'fs';
import { apolloServer as apolloServerV2 } from "./routes/graphql-v2";
import { handler as healthHandler } from "./routes/health";
import { handler as newTxHandler } from "./routes/new-tx";
import { handler as newChunkHandler } from "./routes/new-chunk";
import { handler as proxyHandler } from "./routes/proxy";
import { handler as webhookHandler } from "./routes/webhooks";
import koiLogs from "koi-logs";
import morgan from "morgan";

var koiLogger = new koiLogs("./");

require("express-async-errors");

initConnectionPool("read", { min: 1, max: 100 });

const app = express();

// connectKoi(app);
app.get("/logs/", async function (req: Request, res: Response) {
  // console.log('entered /logs/ setup fn')
  return await koiLogger.koiLogsHelper(req, res)
});
app.get("/logs/raw/", async function(req: Request, res: Response) { 
  // console.log('entered /logs/raw/ setup fn')
  return await koiLogger.koiRawLogsHelper(req, res)
});
async function buildMiddleware () {
  console.log('koiMiddleWare ', JSON.stringify(koiLogger.middleware), !koiLogger.middleware )
  if (!koiLogger.middleware) {
    koiLogger.middleware = await koiLogger.generateMiddleware()
    console.log('generator returned', koiLogger.middleware)
  }
  return koiLogger.middleware
}
const koiLoggerLogger: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!koiLogger.rawLogFileLocation) {
    console.log('no log location set, waiting for it...')
    await koiLogger.rawLogFileLocation
  }
  console.log(koiLogger.rawLogFileLocation)
  const accessLogStream = fs.createWriteStream(koiLogger.rawLogFileLocation, { flags: 'a' });
  
  var payload = {
    "address": req.ip,
    "date": new Date(),
    "method": req.method,
    "url": req.path,
    "type": req.protocol,
    "res": {
      "length": ":res[content-length]",
      "time": ":response-time ms"
    }
  };
  fs.appendFile(koiLogger.rawLogFileLocation, JSON.stringify(payload) + ",", function (err) {
    if (err) throw err;
    console.log('Saved!');
  });
  next()
}
app.use(koiLoggerLogger)

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
