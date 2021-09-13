import {config} from 'dotenv';
import {connection} from './connection.database';
import {formatBlock} from './block.database';
import {formatTransaction, DatabaseTag} from './transaction.database';
import {BlockType} from '../query/block.query';
import {TransactionType} from '../query/transaction.query';

config();

export async function importBlock(newBlock: BlockType) {
  return new Promise(async (resolve, reject) => {
    try {
      const block = formatBlock(newBlock);

      await connection.table('blocks')
          .insert({
            id: block.id,
            height: block.height,
            mined_at: block.mined_at,
            previous_block: block.previous_block,
            txs: block.txs,
            extended: block.extended,
          })
          .onConflict('id' as never)
          .merge();

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTransaction(newTransaction: TransactionType) {
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = formatTransaction(newTransaction);

      await connection.table('transactions')
          .insert(transaction)
          .onConflict('id' as never)
          .merge();

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTag(tag: DatabaseTag) {
  return new Promise(async (resolve, reject) => {
    try {
      await connection.table('tags')
          .insert({
            tx_id: tag.tx_id,
            index: tag.index,
            name: tag.name,
            value: tag.value,
          })
          .onConflict(['tx_id' as never, 'index' as never])
          .merge();

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}
