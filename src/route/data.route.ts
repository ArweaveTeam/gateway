import {config} from 'dotenv';
import {read, exists} from 'fs-jetpack';
import {Request, Response} from 'express';
import {connection} from '../database/connection.database';
import {ManifestV1} from '../types/manifest.types';
import {log} from '../utility/log.utility';
import {transaction as getTransaction, tagValue} from '../query/transaction.query';
import {cacheFolder, cacheFile, cacheAnsFile} from '../caching/file.caching';

config();

export const dataRouteRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;
export const pathRegex = /^\/?([a-z0-9-_]{43})/i;

export const port = process.env.PORT || '3000';
export const manifestPrefix = process.env.MANIFEST_PREFIX || 'amp-gw.online';

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

  try {
    const metadata = await getTransaction(transaction);
    const contentType = tagValue(metadata.tags, 'Content-Type');
    const ua = tagValue(metadata.tags, 'User-Agent');
    const ans102 = tagValue(metadata.tags, 'Bundle-Type') === 'ANS-102';

    if (req.hostname !== `${transaction}.${manifestPrefix}`) {
      if (contentType === 'application/x.arweave-manifest+json' || contentType === 'application/x.arweave-manifest') {
        const manifestFile = read(`${cacheFolder}/${transaction}`) || '{}';
        const manifest: ManifestV1 = JSON.parse(manifestFile.toString());

        const cachePaths = Object.keys(manifest.paths).map((key) => cacheFile(manifest.paths[key].id));
        await Promise.all(cachePaths);

        for (let i = 0; i < Object.keys(manifest.paths).length; i++) {
          const path_url = Object.keys(manifest.paths)[i];
          const manifest_path = manifest.paths[path_url];

          await connection
            .table('manifest')
            .insert({
              manifest_url: transaction.toLowerCase(),
              manifest_id: transaction,
              path: path_url,
              tx_id: manifest_path.id,
            });
        }
        
        return res.redirect(`http://${transaction}.${manifestPrefix}:${port}`);
      }
    }

    if (ans102) {
      await cacheAnsFile(transaction);
    } else {
      await cacheFile(transaction);
    }

    if (exists(`${cacheFolder}/${transaction}`)) {
      if (contentType && contentType !== 'null') {
        res.setHeader('content-type', contentType);
      }

      res.status(200);
      return res.sendFile(`${cacheFolder}/${transaction}`);
    } else {
      throw new Error('File not found');
    }
  } catch (error) {
    log.error(`[route] error generating response for ${transaction}`);
    console.error(error);

    res.status(500);
    return res.json({status: 'ERROR', message: 'Could not retrieve transaction'});
  }
}
