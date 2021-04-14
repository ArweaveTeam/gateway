import KoiLogs from 'koi-logs';
import {Request, Response} from 'express';

export const koiLogger = new KoiLogs('./');

export async function koiLogsRoute(req: Request, res: Response) {
  return koiLogger.koiLogsHelper(req, res);
}

export async function koiLogsRawRoute(req: Request, res: Response) {
  return koiLogger.koiRawLogsHelper(req, res);
}
