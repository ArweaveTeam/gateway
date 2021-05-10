import {Request, Response} from 'express';

export async function proxyRoute(req: Request, res: Response) {
  return res.redirect(`${req.session.node}/${req.path}`);
}
