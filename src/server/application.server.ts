import express, { Express } from 'express';
import {corsMiddleware} from '../middleware/cors.middleware';
import {jsonMiddleware} from '../middleware/json.middleware';
import {logConfigurationMiddleware, logMiddleware} from '../middleware/log.middleware';
import {log} from '../utility/log.utility';
import { GraphQLServer } from '../graphql/server.graphql';

export const app: Express = express();

export function start() {
  app.set(`trust proxy`, 1);
  app.use(corsMiddleware);
  app.use(jsonMiddleware);
  app.use(logConfigurationMiddleware);
  app.use(logMiddleware);

  GraphQLServer({ introspection: true, playground: true}).applyMiddleware({ app, path: '/graphql' });

  app.listen(process.env.PORT || 3000, () => {
    log.info(`[app] started on http://localhost:${process.env.PORT || 3000}`);
  });
}
