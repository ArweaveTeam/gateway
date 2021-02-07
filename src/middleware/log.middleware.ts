import morgan from 'morgan';
import id from 'shortid';
import fs from 'fs';
import path from 'path';
import {Request, Response, NextFunction} from 'express';

export function logConfigurationMiddleware(req: Request, res: Response, next: NextFunction) {
  const trace = id.generate();

  req.id = trace;
  res.header(`X-Trace`, trace);

  return next();
}

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
 
morgan.token(`trace`, (req: Request) => {
  return req.id || `UNKNOWN`;
});

export const logMiddleware = morgan('[http] :remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms ":referrer" ":user-agent" [trace=:trace]', { stream: accessLogStream });
