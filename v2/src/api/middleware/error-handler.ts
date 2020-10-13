import { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, isHttpError } from "http-errors";

export const handler: ErrorRequestHandler = (error, req, res, next) => {
  console.error("handling", error);

  if (isHttpError(error)) {
    console.log("error.statusCode", error.statusCode);
    res.status(error.statusCode);
    res.write(Buffer.from(JSON.stringify(error), "utf8"));
    return next();
  }

  res.status(500);
  res.write(Buffer.from(JSON.stringify({ error: "unknown" }), "utf8"));

  res.end();

  return next();
};
