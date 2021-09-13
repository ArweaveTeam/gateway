import {Request, Response, NextFunction} from 'express';
import {post} from 'superagent';
import {getLastBlock} from '../utility/height.utility';
import {TransactionType} from '../query/transaction.query';
import {insertTransaction, insertTag} from '../database/insert.database';

export async function precacheTransaction(req: Request) {
  const precacheHeight = await getLastBlock();

  const precachedTransaction: TransactionType = {
    format: req.body.format,
    id: req.body.id,
    last_tx: req.body.last_tx,
    owner: req.body.owner,
    tags: req.body.tags,
    target: req.body.target,
    quantity: req.body.quantity,
    data: req.body.data,
    data_size: req.body.data_size,
    data_root: req.body.data_root,
    data_tree: [],
    reward: req.body.reward,
    signature: req.body.signature,
    parent: '',
  };

  await insertTransaction(precachedTransaction, null, precacheHeight);
  await insertTag(precachedTransaction.id, precachedTransaction.tags);
}

export async function transactionRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await post(`${req.session.node}/tx`).send(req.body);
    await precacheTransaction(req);
    return res.status(200).send(payload.body);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
}
