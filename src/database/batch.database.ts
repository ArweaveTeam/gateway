import {DataItemJson} from 'arweave-bundles';
import {Transaction, QueryBuilder} from 'knex';
import {connection} from './connection.database';
import {BlockType} from '../query/block.query';
import {getData} from '../query/node.query';
import {transaction, TransactionType, tagValue} from '../query/transaction.query';
import {formatBlock} from './block.database';
import {formatTransaction, DatabaseTag, ANSTransaction, formatAnsTransaction} from './transaction.database';
import {utf8DecodeTag} from '../utility/encoding.utility';
import {ansBundles} from '../utility/ans.utility';

export function createBatchItem(batchScope: Transaction, table: string, data: object, conflictKey: string = `id`): QueryBuilder {
  return batchScope
      .insert(data)
      .into(table)
      .onConflict(conflictKey as any)
      .ignore();
}

export function createBatchItemForTag(batchScope: Transaction, table: string, data: object): QueryBuilder {
  return batchScope
      .insert(data)
      .into(table);
}

export function createBlockBatchItem(batchScope: Transaction, block: BlockType): QueryBuilder {
  const formattedBlock = formatBlock(block);
  return createBatchItem(batchScope, 'blocks', formattedBlock);
}

export function createTransactionBatchItem(batchScope: Transaction, transaction: TransactionType): QueryBuilder {
  const formattedTransaction = formatTransaction(transaction);
  return createBatchItem(batchScope, 'transactions', formattedTransaction);
}

export function createTagBatchItem(batchScope: Transaction, tag: DatabaseTag): QueryBuilder {
  return createBatchItemForTag(batchScope, 'tags', tag);
}

export function processTransaction(batchScope: Transaction, payload: TransactionType): QueryBuilder[] {
  const batch: QueryBuilder[] = [];

  batch.push(createTransactionBatchItem(batchScope, payload));

  const id = payload.id;
  const tags = payload.tags;

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const {name, value} = utf8DecodeTag(tag);

    const formattedTag: DatabaseTag = {
      tx_id: id,
      index: i,
      name: name || '',
      value: value || '',
    };

    batch.push(createTagBatchItem(batchScope, formattedTag));
  }

  return batch;
}

export async function processANSTransaction(batchScope: Transaction, ansTxs: DataItemJson[]): Promise<QueryBuilder[]> {
  const batch: QueryBuilder[] = [];

  for (let i = 0; i < ansTxs.length; i++) {
    const ansTx = ansTxs[i];
    const formattedAnsTx: ANSTransaction = formatAnsTransaction(ansTx);

    batch.push(createBatchItem(batchScope, 'transactions', formattedAnsTx));

    const ansTags = ansTx.tags;

    for (let ii = 0; ii < ansTags.length; ii++) {
      const ansTag = ansTags[ii];
      const {name, value} = await ansBundles.decodeTag(ansTag);

      const formattedTag: DatabaseTag = {
        tx_id: ansTx.id,
        index: ii,
        name: name || '',
        value: value || '',
      };

      batch.push(createTagBatchItem(batchScope, formattedTag));
    }
  }

  return batch;
}

export async function storeBlock(block: BlockType) {
  return await connection.transaction(async (batchScope) => {
    let batch = [];

    batch.push(createBlockBatchItem(batchScope, block));

    for (let i = 0; i < block.txs.length; i++) {
      const tx = block.txs[i];
      const payload = await transaction(tx);

      batch = batch.concat(processTransaction(batchScope, payload));

      const ans102 = tagValue(payload.tags, 'Bundle-Type') === 'ANS-102';

      if (ans102) {
        try {
          const ansPayload = await getData(payload.id);
          const ansTxs = await ansBundles.unbundleData(ansPayload);

          batch = batch.concat(await processANSTransaction(batchScope, ansTxs));
        } catch (error) {
          console.error(error);
        }        
      }
    }

    try {
      await Promise.all(batch);
    } catch (error) {
      console.error(error);
    }

    return true;
  });
}
