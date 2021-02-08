import {Request, Response} from 'express';

export async function chunkOptionsRoute(req: Request, res: Response) {
  return res.send('OK').end();
}

export async function chunkRoute(req: Request, res: Response) {

}
