import { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, NotFound } from "http-errors";

export const errorResponseHandler: ErrorRequestHandler = (
  error: HttpError,
  req,
  res,
  next
) => {
  req.log.error(error);
  const response = {
    status: error.expose ? error.status : 500,
    error: error.expose ? error.message : "unknown",
    ...(res.sentry && { id: res.sentry }),
  };

  if (!res.headersSent) {
    res.status(response.status);
    res.contentType("application/json");

    if (res.sentry) {
      res.header("X-Sentry", res.sentry);
    }
  }

  if (!res.finished) {
    res.write(Buffer.from(JSON.stringify(response), "utf8"));
  }
  res.end();
};

export const notFoundHandler: RequestHandler = (req, res, next) => {
  throw new NotFound();
};
