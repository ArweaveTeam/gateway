import {Request, Response} from 'express';
import {currentHeight} from '../database/sync.database';
import {getNodeInfo} from '../query/node.query';

export const start = Number(new Date);

export async function statusRoute(req: Request, res: Response) {
  const info = await getNodeInfo();

  const delta = info.height - currentHeight;

  return res.status(200).send({
    status: 'OK',
    gatewayHeight: currentHeight,
    arweaveHeight: info.height,
    delta,
  });
}
