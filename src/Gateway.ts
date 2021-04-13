import 'colors';
import express, {Express, Request, Response, RequestHandler} from 'express';
import {config} from 'dotenv';
import {corsMiddleware} from './middleware/cors.middleware';
import {jsonMiddleware} from './middleware/json.middleware';
import {logMiddleware} from './middleware/log.middleware';
import {log} from './utility/log.utility';
import {graphServer} from './graphql/server.graphql';
import {statusRoute} from './route/status.route';
import {proxyRoute} from './route/proxy.route';
import {dataRouteRegex, dataHeadRoute, dataRoute} from './route/data.route';
import {peerRoute} from './route/peer.route';
import {startSync} from './database/sync.database';
import KoiLogs from 'koi-logs';

config();

export const app: Express = express();

const koiLogger = new KoiLogs('./');

app.get('/logs/', async function(req: Request, res: Response) {
  return koiLogger.koiLogsHelper(req, res);
}) as RequestHandler;
app.get('/logs/raw/', async function(req: Request, res: Response) { 
  return koiLogger.koiRawLogsHelper(req, res);
}) as RequestHandler;

app.use(koiLogger.logger);

export function start() {
  app.set('trust proxy', 1);
  app.use(corsMiddleware);
  app.use(jsonMiddleware);
  app.use(logMiddleware);

  app.get('/', statusRoute);
  
  app.head(dataRouteRegex, dataHeadRoute);
  app.get(dataRouteRegex, dataRoute);

  graphServer({introspection: true, playground: true}).applyMiddleware({app, path: '/graphql'});

  app.get('/peers', peerRoute);
  app.all('*', proxyRoute);

  app.listen(process.env.PORT || 3000, () => {
    log.info(`[app] started on http://localhost:${process.env.PORT || 3000}`);
    startSync();
  });
}


(async () => await start())();
