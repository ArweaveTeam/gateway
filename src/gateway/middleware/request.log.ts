import morgan from "morgan";
import shortId from "shortid";
import { RequestHandler } from "express";

import log from "../../lib/log";

export const configureRequestLogging: RequestHandler = (req, res, next) => {
  const traceId = shortId.generate();
  
  req.id = traceId;
  res.header("X-Trace", traceId);
  req.log = log.child({ trace: traceId });
  
  return next();
};

morgan.token("trace", (req) => {
  return getTraceId(req);
});

export const handler = morgan(
  '[http] :remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms ":referrer" ":user-agent" [trace=:trace]',
  { stream: { write: (str) => log.log("info", str) } },
);

const getTraceId = (req: any): string => {
  return req.id || "";
};