import { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, isHttpError } from "http-errors";

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const status = isHttpError(error) && error.expose ? error.statusCode : 500;

  console.error(`[middleware/error] ${req.path}: ${error.stack}`);

  if (!res.headersSent) {
    res.status(status);
  }

  const response = {
    status,
    error: isHttpError(error) && error.expose ? error.message : "unknown",
  };

  res.json(response);

  res.end();
};
