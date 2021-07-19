import {config} from 'dotenv';
import {connection} from './connection.database';
import {formatBlock} from './block.database';
import {formatTransaction, DatabaseTag} from './transaction.database';
import {BlockType} from '../query/block.query';
import {TransactionType} from '../query/transaction.query';

config();

export interface ImportBuffer {
  blocks: Array<BlockType>;
  transactions: Array<TransactionType>;
  tags: Array<DatabaseTag>;
}

export const importBuffer: ImportBuffer = {
  blocks: [],
  transactions: [],
  tags: [],
};

export function clearBuffer() {
  importBuffer.blocks = [];
  importBuffer.transactions = [];
  importBuffer.tags = [];
}

export async function importBlocks() {
  return new Promise(async (resolve, reject) => {
    try {
      const promises = [];

      for (let i = 0; i < importBuffer.blocks.length; i++) {
        const block = formatBlock(importBuffer.blocks[i]);

        const query = connection.table('blocks')
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

        promises.push(query);
      }

      await Promise.all(promises);

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTransactions() {
  return new Promise(async (resolve, reject) => {
    try {
      const promises = [];

      for (let i = 0; i < importBuffer.transactions.length; i++) {
        const transaction = formatTransaction(importBuffer.transactions[i]);

        const query = connection.table('transactions')
            .insert(transaction)
            .onConflict('id' as never)
            .merge();

        promises.push(query);
      }

      await Promise.all(promises);

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTags() {
  return new Promise(async (resolve, reject) => {
    try {
      const promises = [];

      for (let i = 0; i < importBuffer.tags.length; i++) {
        const tag = importBuffer.tags[i];

        const query = connection.table('tags')
            .insert({
              tx_id: tag.tx_id,
              index: tag.index,
              name: tag.name,
              value: tag.value,
            })
            .onConflict(['tx_id' as never, 'index' as never])
            .merge();

        promises.push(query);
      }

      await Promise.all(promises);

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}
