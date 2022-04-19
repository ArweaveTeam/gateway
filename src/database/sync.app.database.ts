import {config} from 'dotenv';
import {log} from '../utility/log.utility';
import {getLastBlock} from '../utility/height.utility';

import {block} from '../query/block.query';
import {validateTransaction} from '../utility/filter.utility';
import {getCurrentHeight, transaction, TransactionType} from '../query/transaction.query';
import {retrieveTransaction} from '../query/gql.query';
import {insertBlock, transactionCached, removeStaleTransactions, insertTransaction, insertTag} from './insert.database';

const REQUEST_BLOCK_RETRY_TIME = process.env.REQUEST_BLOCK_RETRY_TIME || 10; // seconds
const SKIP_BLOCK_ATTEMPTS = process.env.SKIP_BLOCK_ATTEMPTS || 0;

config();

export const startHeight = parseInt(process.env.START_HEIGHT || '0');

export async function syncAppNode() {
  const lastBlock = await getLastBlock();
  const startBlock = lastBlock ? lastBlock - 1 : startHeight;

  log.info(`[database] starting app node sync at ${startBlock}`);
  await storeBlock(startBlock);
}

export async function storeBlock(height: number, retry = 0, retryTime = REQUEST_BLOCK_RETRY_TIME) {
  try {
    log.info(`[database] storing block #${height}`);
    const currentBlock = await block(height);
    await storeTransactions(currentBlock.txs, height);
    await insertBlock(currentBlock);
    await removeStaleTransactions(height);
    await storeBlock(height + 1);
  } catch (error) {
    console.log(error);
    log.info(`[database] block ${height} may have not been mined yet, retrying in ${retryTime} seconds`);
    setTimeout(async () => {
      if (SKIP_BLOCK_ATTEMPTS === 0 ||   retry < +SKIP_BLOCK_ATTEMPTS) {
        await storeBlock(height, retry + 1);
      } else {
        try {
          log.info(`[database] block ${height} not found, try to skip it after many retries`);
          const currentHeight = await getCurrentHeight();
          if (height < currentHeight) {
            // it means there are more blocks to save, so it will skip current unreacheable block
            await storeBlock(height + 1);
          } else {
            // it means there are no more blocks to save since they weren't mined yet
            // it will set retries to 0 and increase the retry time
            await storeBlock(height, 0, 60);
          }
        } catch (e) {
          // coudn't get current height, just keep on the retry logic
          await storeBlock(height, 0, 60);
        }
      }
    }, +retryTime * 1000);
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
    if (validateTransaction(currentTransaction.id, currentTransaction.tags) || await transactionCached(tx)) {
      log.info(`[database] valid transaction for app node found ${tx}`);
      await insertTransaction(currentTransaction, height);
      await insertTag(currentTransaction.id, currentTransaction.tags);
    }
  } catch (error) {
    if (retry) {
      log.info(`[database] could not retrieve tx ${tx} at height ${height}, retrying`);
      const gqlTx = await retrieveTransaction(tx);
      log.info(`[database] recovered tx ${tx} at height ${height} from arweave.net`);

      if (validateTransaction(gqlTx.id, gqlTx.tags) || await transactionCached(tx)) {
        log.info(`[database] valid transaction for app node found ${tx}`);
        const fmtTx: TransactionType = {
          format: 2,
          id: gqlTx.id,
          last_tx: '',
          owner: gqlTx.owner.address,
          tags: gqlTx.tags,
          target: gqlTx.recipient,
          quantity: gqlTx.quantity.winston,
          data: '',
          data_root: '',
          data_size: gqlTx.data.size,
          data_tree: [],
          reward: gqlTx.fee.winston,
          signature: gqlTx.signature,
          parent: gqlTx.bundledIn?.id,
        };
        await insertTransaction(fmtTx, height);
        await insertTag(fmtTx.id, fmtTx.tags);
      }
    }
  }
}
