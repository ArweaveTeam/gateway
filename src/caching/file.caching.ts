import {config} from 'dotenv';
import {exists} from 'fs-jetpack';
import {streamAndCacheTx} from './stream.caching';
import {streamAndCacheAns} from './ans.caching';

config();

export const cacheFolder = process.env.CACHE_FOLDER;

export async function cacheFile(id: string) {
  if (exists(`${cacheFolder}/${id}`) === false) {
    await streamAndCacheTx(id);
  }
}

export async function cacheAnsFile(id: string) {
  if (exists(`${cacheFolder}/${id}`) === false) {
    await streamAndCacheAns(id);
  }
}
