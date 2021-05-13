import {exists} from 'fs-jetpack';
import {streamAndCacheTx} from './stream.caching';
import {streamAndCacheAns} from './ans.caching';

export async function cacheFile(id: string) {
  if (exists(`${process.cwd()}/cache/tx/${id}`) === false) {
    await streamAndCacheTx(id);
  }
}

export async function cacheAnsFile(id: string) {
  if (exists(`${process.cwd()}/cache/tx/${id}`) === false) {
    await streamAndCacheAns(id);
  }
}
