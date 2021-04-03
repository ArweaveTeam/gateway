import {connection} from '../database/connection.database';

export let lastBlock = 0;

export async function cacheLastBlock() {
  const result = await connection
      .queryBuilder()
      .select('height')
      .from('blocks')
      .orderBy('height', 'desc')
      .limit(1);

  if (result.length > 0) {
    lastBlock = result[0].height;
  } else {
    lastBlock = 0;
  }
}

export async function cacheLastBlockHook() {
  await cacheLastBlock();

  setInterval(() => {
    cacheLastBlock();
  }, 1000 * 30);
}
