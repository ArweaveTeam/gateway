import {Request, Response, NextFunction} from 'express';
import {config} from 'dotenv';
import {lookup} from 'mime-types';
import {connection} from '../database/connection.database';
import {log} from '../utility/log.utility';
import {cacheFolder} from '../caching/file.caching';
import {pathRegex} from '../route/data.route';

config();

export const port = process.env.PORT || '3000';
export const manifestPrefix = process.env.MANIFEST_PREFIX || 'amp-gw.net';

export async function manifestMiddleware(req: Request, res: Response, next: NextFunction) {
  const prefix = req.hostname.split('.')[0].match(pathRegex) || [];
  const prefixUri = prefix.length > 1 ? prefix[1] : '';

  if (prefixUri && req.method === 'GET') {
    try {
      const path = req.path.substring(1) || 'index.html';

      const data = await connection
        .table('manifest')
        .where('manifest_url', prefixUri)
        .where('path', path);

        if (data.length > 0) {
          const tx_id = data[0].tx_id;

          if (lookup(path)) {
            res.set('content-type', lookup(path) as string);
          }

          return res.sendFile(`${cacheFolder}/${tx_id}`);
        } else {
          res.status(404);
          return res.json({ status: 'ERROR', message: 'Path not found' });
        }
    } catch (error) {
        log.error(`[route] error generating response for ${prefixUri}`);
        console.error(error);
        res.status(500);
        return res.json({status: 'ERROR', message: 'Could not retrieve transaction'});
    }
  } else {
    return next();
  }
}
