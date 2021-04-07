import 'colors';
import {connection} from '../database/connection.database';
import {convertTags, Tag} from '../query/transaction.query';

export const pagination = 1000;

export async function verifyTransactions(offset: number = 0) {
  const transactions = await connection
      .queryBuilder()
      .select('*')
      .from('transactions')
      .orderBy('height', 'desc')
      .whereNotNull('height')
      .where('height', '>', 650000)
      .limit(pagination)
      .offset(offset);

  if (transactions.length === 0) {
    console.log('Completed verification of transactions'.green.bold);
    process.exit();
  }


  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    try {
      const b64Tags = transaction.tags as Array<Tag>;
      const tags = convertTags(b64Tags);

      for (let ii = 0; ii < tags.length; ii++) {
        const tag = tags[ii];

        const tx_id = transaction.id;
        const index = ii;
        const name = tag.name;
        const value = tag.value;

        try {
          await connection
              .queryBuilder()
              .into('tags')
              .insert({tx_id, index, name, value});
        } catch (error) {
          console.log('Insertion of tag failed, most likely already in database'.yellow);
        }
      }

      console.log(`Successfully verified ${tags.length} tags on ${transaction.id} for block height ${transaction.height}`.green);
    } catch (error) {
      console.error(`Error parsing ${transaction.id} at block height ${transaction.height}`.red);
    }
  }

  console.log(`Verified ${offset} transactions so far`.green);
  verifyTransactions(offset + pagination);
}

(async () => await verifyTransactions())();
