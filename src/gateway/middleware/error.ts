import { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, NotFound } from "http-errors";
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  normalizeDepth: 5,
  environment: process.env.NODE_ENV,
});

export const sentryCaptureRequestHandler = Sentry.Handlers.requestHandler({
  ip: true,
  request: true,
  transaction: "handler",
  version: true,
});

export const sentryReportErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    return error && ![404].includes(error.status as number);
  },
});

export const errorResponseHandler: ErrorRequestHandler = (
  error: HttpError,
  req,
  res,
  next
) => {
  const response = {
    status: error.expose ? error.status : 500,
    error: error.expose ? error.message : "unknown",
    ...(res.sentry && { id: res.sentry }),
  };

  if (res.sentry) {
    res.header("X-Sentry", res.sentry);
  }

  res.status(response.status);

  res.send(response);
};

export const notFoundHandler: RequestHandler = (req, res, next) => {
  throw new NotFound();
};
