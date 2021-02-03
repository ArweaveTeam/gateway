import {Request, Response} from 'express';
import {log} from '../utility/log.utility';
import {getNodeInfo} from '../query/node.query';

export async function proxyRoute(req: Request, res: Response) {
  try {
    const payload = await getNodeInfo();
    return res.status(200).send(payload);
  } catch (error) {
    log.error(error);
    return res.status(500).send({
      status: 'ERROR',
      message: 'Could not ping node',
    });
  }
}
