import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  normalizeDepth: 5,
  environment: process.env.NODE_ENV,
});

export const sentryRequestHandler = Sentry.Handlers.requestHandler({
  ip: true,
  request: true,
  transaction: "handler",
  version: true,
});

export const sentryTraceHandler = Sentry.Handlers.tracingHandler();

export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    return error && ![404].includes(error.status as number);
  },
});
