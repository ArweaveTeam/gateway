import {Request, Response} from 'express';

export async function transactionOptionsRoute(req: Request, res: Response) {
  return res.send('OK').end();
}

export async function transactionRoute(req: Request, res: Response) {

}
