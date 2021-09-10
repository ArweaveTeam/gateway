import {config} from 'dotenv';
import {log} from '../utility/log.utility';
import {getLastBlock} from '../utility/height.utility';

import {block} from '../query/block.query';
import {validateTransaction} from '../utility/filter.utility';
import {transaction, TransactionType, tagToB64} from '../query/transaction.query';
import {retrieveTransaction} from '../query/gql.query';
import {insertBlock, insertTransaction, insertTag} from './insert.database';


config();

export const startHeight = parseInt(process.env.START_HEIGHT || '0');

export async function syncAppNode() {
  const lastBlock = await getLastBlock();
  const startBlock = lastBlock ? lastBlock - 1 : startHeight;

  log.info(`[database] starting app node sync at ${startBlock}`);
  await storeBlock(startBlock);
}

export async function storeBlock(height: number) {
  try {
    log.info(`[database] storing block #${height}`);
    const currentBlock = await block(height);
    await storeTransactions(currentBlock.txs, height);
    await insertBlock(currentBlock);
    await storeBlock(height + 1);
  } catch (error) {
    log.info(`[database] block ${height} may have not been mined yet, retrying in 60 seconds`);
    setTimeout(async () => {
      await storeBlock(height);
    }, 60 * 1000);
  }
}

export async function storeTransactions(txs: Array<string>, height: number) {
  const batch = [];

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    batch.push(storeTransaction(tx, height));
  }

  await Promise.all(batch);
}

export async function storeTransaction(tx: string, height: number, retry: boolean = true) {
  try {
    const currentTransaction = await transaction(tx);
    if (validateTransaction(currentTransaction.id, currentTransaction.tags)) {
      log.info(`[database] valid transaction for app node found ${tx}`);
      await insertTransaction(currentTransaction, height);
      await insertTag(currentTransaction.id, currentTransaction.tags);
    }
  } catch (error) {
    if (retry) {
      log.info(`[database] could not retrieve tx ${tx} at height ${height}, retrying`);
      const gqlTx = await retrieveTransaction(tx);
      if (validateTransaction(gqlTx.id, gqlTx.tags)) {
        log.info(`[database] valid transaction for app node found ${tx}`);
        const fmtTx: TransactionType = {
          format: 2,
          id: gqlTx.id,
          last_tx: '',
          owner: gqlTx.owner.address,
          tags: tagToB64(gqlTx.tags),
          target: gqlTx.recipient,
          quantity: gqlTx.quantity.winston,
          data: '',
          data_root: '',
          data_size: gqlTx.data.size,
          data_tree: [],
          reward: gqlTx.fee.winston,
          signature: gqlTx.signature,
          parent: gqlTx.bundledIn.id,
        };

        await insertTransaction(fmtTx, height);
        await insertTag(fmtTx.id, fmtTx.tags);
      }
    }
  }
}
