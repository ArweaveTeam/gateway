import {Request, Response} from 'express';
import {getDataAsStream} from '../query/node.query';
import {transaction as getTransaction} from '../query/transaction.query';

export const dataRouteRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;
export const pathRegex = /^\/?([a-z0-9-_]{43})/i;

export async function dataHeadRoute(req: Request, res: Response) {
  const path = req.path.match(pathRegex) || [];
  const transaction = path.length > 1 ? path[1] : '';
  const metadata = await getTransaction(transaction);
  
  res.status(200);
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('content-length', Number(metadata.data_size));

  res.end();
}

export async function dataRoute(req: Request, res: Response) {
  const path = req.path.match(pathRegex) || [];
  const transaction = path.length > 1 ? path[1] : ''; 
  
  const payload = getDataAsStream(transaction);
  return payload.pipe(res);
}
