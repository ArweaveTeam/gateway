import { RequestHandler } from "express";

export const handler: RequestHandler = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", req.method);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
};
