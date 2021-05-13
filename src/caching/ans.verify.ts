import 'colors';
import {connection} from '../database/connection.database';
import {toB64url} from '../query/transaction.query';
import {cacheAnsFile} from './file.caching';

const name = toB64url('Bundle-Type');
const value = toB64url('ANS-102');

export async function ansVerify(offset: number = 0) {
  const query = await connection
      .queryBuilder()
      .select('*')
      .from('tags')
      .where('name', name)
      .where('value', value)
      .orderByRaw('created_at ASC')
      .limit(10)
      .offset(offset);

  for (let i = 0; i < query.length; i++) {
    const item = query[i];

    try {
      await cacheAnsFile(item.tx_id);
    } catch (error) {
      console.log(`Could not cache ${item.tx_id}`.red);
    }
  }

  console.log(`Successfully cached ANS bundles at offset ${offset}`.green);

  if (query.length === 0) {
    console.log('Successfully cached all ANS bundles. Good work!'.green.bold);
    process.exit();
  } else {
    ansVerify(offset + 10);
  }
}

(async () => await ansVerify())();
