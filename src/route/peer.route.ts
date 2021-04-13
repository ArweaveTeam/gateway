import {Request, Response} from 'express';

export async function peerRoute(req: Request, res: Response) {
  return res.status(200).send({
    status: 'OK',
    nodes: [
      'https://gateway-n2.amplify.host',
    ],
  });
}
