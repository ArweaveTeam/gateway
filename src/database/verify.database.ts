import {connection} from './connection.database';

export const pagination = 25;

export async function verifyTransactions(offset: number = 0) {
  const transactions = await connection
      .queryBuilder()
      .select('*')
      .from('transactions')
      .whereNull('height')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(pagination)
      .offset(offset);

  if (transactions.length === 0) {
    console.log('Completed verification of transactions'.green.bold);
    process.exit();
  }

  /*
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
  }
  */

  console.log(`Verified ${offset} transaction so far`.green);
  verifyTransactions(offset + pagination);
}

export async function verifyTags(offset: number = 0) {
  const transactions = await connection
      .queryBuilder()
      .select('*')
      .from('transactions')
      .whereNull('height')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(pagination)
      .offset(offset);

  if (transactions.length === 0) {
    console.log('Completed verification of transactions'.green.bold);
    process.exit();
  }

  console.log(`Verified ${offset} tags so far`.green);
  verifyTags(offset + pagination);
}
