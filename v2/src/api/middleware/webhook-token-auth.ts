import { RequestHandler } from "express";
import createHttpError from "http-errors";

const token = process.env.WEBHOOK_TOKEN;

export const webhookAuthHandler: RequestHandler = (req, res, next) => {
  if (!token) {
    console.log(`Undefined env variable: WEBHOOK_TOKEN`);
    throw createHttpError(404);
  }
  if (req.query.token !== token) {
    throw createHttpError(400);
  }

  next();
};
