import {Request, Response, NextFunction} from 'express';
import expressSession from 'express-session';
import {grabNode} from '../query/node.query';

export const sessionMiddleware = expressSession({
  secret: process.env.SESSION_SECRET || 'gateway123',
  resave: false,
  saveUninitialized: false,
});

export function sessionPinningMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session.node) {
    req.session.node = grabNode();
  }

  return next();
}
