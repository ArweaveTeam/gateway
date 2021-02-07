import morgan from 'morgan';
import id from 'shortid';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

// TODO: @theloneronin what's the best place to put this file?
var logFileLocation = path.join(__dirname, '../../access.log')
var accessLogStream = fs.createWriteStream(logFileLocation, { flags: 'a' })

export function logConfigurationMiddleware(req: Request, res: Response, next: NextFunction) {
  const trace = id.generate();

  req.id = trace;
  res.header(`X-Trace`, trace);

  return next();
}

morgan.token(`trace`, (req: Request) => {
  return req.id || `UNKNOWN`;
});

// TODO - add encryption on the line below for :remote-addr to protect viewer's privacy
export const logMiddleware = morgan('[http] :remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms ":referrer" ":user-agent" [trace=:trace]', { stream: accessLogStream});
