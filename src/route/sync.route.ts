import {Request, Response} from 'express';
import {currentHeight} from '../database/sync.database';
import {getNodeInfo} from '../query/node.query';

export const start = Number(new Date);

export async function syncRoute(req: Request, res: Response) {
  const info = await getNodeInfo();

  const delta = info.height - currentHeight;
  const status = delta < 3 ? 200 : 400;

  return res.status(status).send({
    status: 'OK',
    gatewayHeight: currentHeight,
    arweaveHeight: info.height,
    delta,
  });
}
