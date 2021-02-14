import 'colors';
import express, {Express} from 'express';
import {config} from 'dotenv';
import {corsMiddleware} from './middleware/cors.middleware';
import {jsonMiddleware} from './middleware/json.middleware';
import {logMiddleware} from './middleware/log.middleware';
import {log} from './utility/log.utility';
import {graphServer} from './graphql/server.graphql';
import {proxyRoute} from './route/proxy.route';
import {dataRouteRegex, dataRoute} from './route/data.route';
import { startSync } from './database/sync.database';
import { logsHelper, logsTask, getLogSalt } from './utility/log.helper';
import cron from 'node-cron';

config();

export const app: Express = express();

export function start() {
  app.set(`trust proxy`, 1);
  app.use(corsMiddleware);
  app.use(jsonMiddleware);
  app.use(logMiddleware);

  cron.schedule('0 0 * * *', function() {
    console.log('running the log cleanup task once per day');
    logsTask()
  });

  graphServer({introspection: true, playground: true}).applyMiddleware({app, path: '/graphql'});

  app.get(dataRouteRegex, dataRoute);
  app.get("/logs", logsHelper);
  app.get("/trigger-logs-dev", logsTask);
  app.all('*', proxyRoute);

  app.listen(process.env.PORT || 3000, () => {
    log.info(`[app] started on http://localhost:${process.env.PORT || 3000}`);
    startSync();
  });
}


(async () => await start())();
