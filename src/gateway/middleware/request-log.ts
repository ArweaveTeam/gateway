import morgan from "morgan";
import { RequestHandler, Request } from "express";
import shortId from "shortid";
import log from "../../lib/log";
import { createLogger, transports, format } from "winston";
import * as Sentry from "@sentry/node";

export const configureRequestLogging: RequestHandler = (req, res, next) => {
  const traceId = shortId.generate();
  req.id = traceId;
  res.header("X-Trace", traceId);
  req.log = log.child({
    trace: traceId,
  });
  Sentry.configureScope(function (scope) {
    scope.setTag("trace", traceId);
    scope.setTag("aws_trace", getTraceId(req));
  });
  next();
};

morgan.token("trace", (req) => {
  return getTraceId(req);
});

morgan.token("aws_trace", (req) => {
  return getAwsTraceId(req);
});

export const handler = morgan(
  '[http] :remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms ":referrer" ":user-agent" [trace=:trace] [aws_trace=:aws_trace]',
  {
    stream: { write: (str) => log.log("info", str) },
  }
);

const getTraceId = (req: Request): string => {
  return req.id || "";
};

const getAwsTraceId = (req: Request): string => {
  return req.headers["x-amzn-trace-id"]
    ? (req.headers["x-amzn-trace-id"] as string)
    : "";
};
