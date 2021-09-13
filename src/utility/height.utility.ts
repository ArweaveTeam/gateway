import {connection} from '../database/connection.database';

export async function getLastBlock(): Promise<number> {
  const result = await connection
      .queryBuilder()
      .select('height')
      .from('blocks')
      .orderBy('height', 'desc')
      .limit(1);

  if (result.length > 0) {
    return result[0].height as number;
  } else {
    return 0;
  }
}
