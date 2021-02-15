import {Request, Response} from 'express';
import {bar, currentHeight} from '../database/sync.database';
import {getNodeInfo} from '../query/node.query';

export const elapsed = Number(new Date);

export async function statusRoute(req: Request, res: Response) {
    const info = await getNodeInfo();
    
    return res.status(200).send({
        status: 'OK',
        currentHeight,
        height: info.height,
        delta: info.height - currentHeight,
        eta: `${elapsed * (bar.total / bar.curr - 1)} seconds`,
    });
  }
  