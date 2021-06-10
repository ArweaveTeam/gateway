import {config} from 'dotenv';
import {read, exists} from 'fs-jetpack';
import {Request, Response} from 'express';
import {ManifestV1} from '../types/manifest.types';
import {log} from '../utility/log.utility';
import {transaction as getTransaction, tagValue} from '../query/transaction.query';
import {cacheFolder, cacheFile, cacheAnsFile} from '../caching/file.caching';

config();

export const dataRouteRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;
export const pathRegex = /^\/?([a-z0-9-_]{43})/i;

export const manifestPrefix = process.env.MANIFEST_PREFIX || 'https://gateway.amplify.host';

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

    if (ans102) {
      await cacheAnsFile(transaction);
    } else {
      await cacheFile(transaction);

      if (exists(`${cacheFolder}/${transaction}`)) {
        if (contentType === 'application/x.arweave-manifest+json' || contentType === 'application/x.arweave-manifest') {
          res.setHeader('content-type', 'text/html');

          const manifestFile = read(`${cacheFolder}/${transaction}`) || '{}';
          const manifest: ManifestV1 = JSON.parse(manifestFile.toString());

          const manifestIndex = manifest.index.path;
          const manifestIndexTransaction = manifest.paths[manifestIndex].id;

          const cachePaths = Object.keys(manifest.paths).map((key) => cacheFile(manifest.paths[key].id));
          await Promise.all(cachePaths);

          if (exists(`${cacheFolder}/${manifestIndexTransaction}`)) {
            let manifestHtml = read(`${cacheFolder}/${manifestIndexTransaction}`) || '';

            Object.keys(manifest.paths).map((key) => {
              const id = manifest.paths[key].id;

              manifestHtml = manifestHtml.split(key).join(`${manifestPrefix}/${id}?manifestId=${transaction}&ext=`);
            });

            res.status(200);
            res.send(manifestHtml);
          } else {
            throw new Error('Could not parse manifest html file');
          }
        } else {
          if (contentType && contentType !== 'null') {
            res.setHeader('content-type', contentType);
          }

          if (ua === 'arkb' && req.query.manifestId) {
            const manifestId = req.query.manifestId;

            const manifestFile = read(`${cacheFolder}/${manifestId}`) || '{}';
            const manifest: ManifestV1 = JSON.parse(manifestFile.toString());

            let arkbFile = read(`${cacheFolder}/${transaction}`) || '';

            Object.keys(manifest.paths).map((key) => {
              const id = manifest.paths[key].id;
              arkbFile = arkbFile.split(key).join(`${id}?manifestId=${manifestId}&ext=`);
            });

            res.status(200);
            res.send(arkbFile);
          } else {
            res.status(200);
            res.sendFile(`${cacheFolder}/${transaction}`);
          }
        }
      }
    }
  } catch (error) {
    log.error(`[route] error generating response for ${transaction}`);
    console.error(error);
    res.status(500);
    res.json({status: 'ERROR', message: 'Could not retrieve transaction'});
  }
}
