import {exists} from 'fs-jetpack';
import {Request, Response} from 'express';
import {stringToBip39, stringToHash} from '../utility/bip39.utility';
import {transaction as getTransaction, tagValue} from '../query/transaction.query';
import {cacheFile, cacheAnsFile} from '../caching/file.caching';

export const dataRouteRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;
export const pathRegex = /^\/?([a-z0-9-_]{43})/i;

export async function dataHeadRoute(req: Request, res: Response) {
  const path = req.path.match(pathRegex) || [];
  const transaction = path.length > 1 ? path[1] : '';
  const metadata = await getTransaction(transaction);

  res.status(200);
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('content-length', Number(metadata.data_size));

  res.end();
}

export async function dataRoute(req: Request, res: Response) {
  const path = req.path.match(pathRegex) || [];
  const transaction = path.length > 1 ? path[1] : '';
  const hostname = req.hostname;

  if (hostname !== 'localhost' && process.env.MANIFESTS === '1') {
    const subdomain = process.env.BIP39 === '1' ? stringToBip39(transaction) : stringToHash(transaction);

    if (hostname.indexOf(subdomain) === -1) {
      return res.redirect(308, `http://${subdomain}.${hostname}/${transaction}`);
    }
  }

  try {
    const metadata = await getTransaction(transaction);
    const contentType = tagValue(metadata.tags, 'Content-Type');
    const ans102 = tagValue(metadata.tags, 'Bundle-Type') === 'ANS-102';

    res.setHeader('content-type', contentType);

    if (ans102) {
      await cacheAnsFile(transaction);
    } else {
      await cacheFile(transaction);
    }
  } catch (error) {

  }

  if (exists(`${process.cwd()}/cache/tx/${transaction}`)) {
    res.status(200);
    res.sendFile(`${process.cwd()}/cache/tx/${transaction}`);
  } else {
    res.status(500);
    res.json({status: 'ERROR', message: 'Could not retrieve transaction'});
  }
}
