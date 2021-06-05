import 'colors';
import express, {Express} from 'express';
import {config} from 'dotenv';
import {corsMiddleware} from './middleware/cors.middleware';
import {jsonMiddleware} from './middleware/json.middleware';
import {logMiddleware} from './middleware/log.middleware';
import {log} from './utility/log.utility';
import {sessionMiddleware, sessionPinningMiddleware} from './utility/session.utility';
import {graphServer} from './graphql/server.graphql';
import {statusRoute} from './route/status.route';
import {syncRoute} from './route/sync.route';
import {proxyRoute} from './route/proxy.route';
import {dataRouteRegex, dataRoute} from './route/data.route';
import {peerRoute} from './route/peer.route';
import {koiLogger, koiLogsRoute, koiLogsRawRoute} from './route/koi.route';
import {startSync} from './database/sync.database';

config();

export const app: Express = express();

export function start() {
  app.set('trust proxy', 1);

  app.use(corsMiddleware);
  app.use(jsonMiddleware);
  app.use(logMiddleware);
  app.use(sessionMiddleware);
  app.use(sessionPinningMiddleware);
  app.use(koiLogger.logger);

  app.get('/', statusRoute);
  app.get('/status', syncRoute);

  app.get(dataRouteRegex, dataRoute);

  graphServer({introspection: true, playground: true}).applyMiddleware({app, path: '/graphql'});

  app.get('/peers', peerRoute);
  app.get('/logs', koiLogsRoute);
  app.get('/logs/raw', koiLogsRawRoute);

  app.all('*', proxyRoute);

  app.listen(process.env.PORT || 3000, () => {
    log.info(`[app] started on http://localhost:${process.env.PORT || 3000}`);
    startSync();
  });
}


(async () => await start())();
