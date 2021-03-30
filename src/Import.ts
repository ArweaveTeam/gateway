import {config} from 'dotenv';
import {log} from './utility/log.utility';
import {importBlocks, importTransactions, importTags} from './database/import.database';

config();

export const BLOCK_PATH = process.env.BLOCK_PATH || 'snapshot/block.csv';
export const TRANSACTION_PATH = process.env.TRANSACTION_PATH || 'snapshot/transaction.csv';
export const TAGS_PATH = process.env.TAGS_PATH || 'snapshot/tags.csv';

export async function importSnapshot() {
  await importBlocks(BLOCK_PATH);
  log.info(`[snapshot] successfully imported ${BLOCK_PATH}`);

  await importTransactions(TRANSACTION_PATH);
  log.info(`[snapshot] successfully imported ${TRANSACTION_PATH}`);

  await importTags(TAGS_PATH);
  log.info(`[snapshot] successfully imported ${TAGS_PATH}`);

  process.exit();
}

(async () => await importSnapshot())();
