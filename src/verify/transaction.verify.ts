import {connection} from '../database/connection.database';

export const pagination = 25;

export async function verifyTransactions(offset: number = 0) {
  const blocks = await connection
      .queryBuilder()
      .select('*')
      .from('blocks')
      .orderBy('height', 'desc')
      .limit(pagination)
      .offset(offset);

  if (blocks.length === 0) {
    console.log('Completed verification of transactions'.green.bold);
    process.exit();
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    try {
      const transactions = JSON.parse(block.txs);
      for (let ii = 0; ii < transactions.length; ii++) {
        // const transaction = transactions[ii];
      }
    } catch (error) {
      console.error(`Error parsing ${block.id} at ${block.height}`);
    }
  }

  console.log(`Verified ${offset} blocks so far`.green);
  verifyTransactions(offset + pagination);
}
