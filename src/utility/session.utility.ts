import {Request, Response, NextFunction} from 'express';
import expressSession from 'express-session';
import PostgresSession from 'express-pg-session';
import {pgConnection} from '../database/connection.database';
import {grabNode} from '../query/node.query';

export const pgSession = new PostgresSession({
  pool: pgConnection,
});

export const sessionMiddleware = expressSession({
  store: pgSession,
  secret: process.env.SESSION_SECRET || 'gateway123',
});

export function sessionPinningMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session.node) {
    req.session.node = grabNode();
  }

  return next();
}
