import 'colors';
import {connection} from '../database/connection.database';
import {transaction} from '../query/transaction.query';

export const pagination = 1000;

export async function pruneTransactions(offset: number = 0) {
  const transactions = await connection
      .queryBuilder()
      .select('*')
      .from('transactions')
      .whereNull('height')
      .orderBy('id', 'asc')
      .limit(pagination)
      .offset(offset);

  if (transactions.length === 0) {
    console.log('Completed verification of transactions'.green.bold);
    process.exit();
  }

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    try {
      await transaction(tx.id);
    } catch (error) {
      console.error(`${tx.id} is invalid, removing from database`.red);
      await connection
          .queryBuilder()
          .from('transactions')
          .where('id', tx.id)
          .delete();
    }
  }

  console.log(`Verified ${offset} transactions so far`.green);
  pruneTransactions(offset + pagination);
}

(async () => await pruneTransactions())();
