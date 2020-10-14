import { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, isHttpError } from "http-errors";

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  console.error("handling", error);

  const status = isHttpError(error) && error.expose ? error.statusCode : 500;

  res.status(status);

  const response = {
    status,
    error: isHttpError(error) && error.expose ? error.message : "unknown",
  };

  res.json(response);

  return next(error);
};
