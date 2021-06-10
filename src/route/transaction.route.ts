import {Request, Response, NextFunction} from 'express';
import {post} from 'superagent';

export async function transactionRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await post(`${req.session.node}/tx`).send(req.body);
    return res.status(200).send(payload.body);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
}
