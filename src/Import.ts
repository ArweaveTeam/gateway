import {config} from 'dotenv';
import {connection} from './database/connection.database';
import {log} from './utility/log.utility';
import {transactionFields} from './database/transaction.database';

config();

export const indices = JSON.parse(process.env.INDICES || '[]') as Array<string>;

export async function importSnapshot() {
  await importBlocks();
  await importTransactions();
  await importTags();

  process.exit();
}

export async function importBlocks() {
  return new Promise(async (resolve) => {
    await connection.raw(`
      COPY
        blocks
        (id, previous_block, mined_at, height, txs, extended)
      FROM
        '${process.cwd()}/snapshot/block.csv'
      WITH
        (
          FORMAT CSV,
          ESCAPE '\\',
          DELIMITER ',',
          FORCE_NULL(height)
        )
      `);
    log.info(`[snapshot] successfully imported block.csv`);
    return resolve(true);
  });
}

export async function importTransactions() {
  return new Promise(async (resolve) => {
    const fields = transactionFields
      .concat(indices)
      .map(field => `"${field}"`);

    await connection.raw(`
      COPY
        transactions
        (${fields.join(',')})
      FROM
        '${process.cwd()}/snapshot/transaction.csv'
      WITH
        (
          FORMAT CSV,
          ESCAPE '\\',
          DELIMITER ',',
          FORCE_NULL("format", "height", "data_size")
        )`);
    log.info(`[snapshot] successfully imported transaction.csv`);
    return resolve(true);
  });
}

export async function importTags() {
  return new Promise(async (resolve) => {
    await connection.raw(`
      COPY
        tags
        (tx_id, index, name, value)
      FROM
        '${process.cwd()}/snapshot/tags.csv'
      WITH
        (
          FORMAT CSV,
          ESCAPE '\\',
          DELIMITER ',',
          FORCE_NULL(index)
        )
      `);
    log.info(`[snapshot] successfully imported tags.csv`);
    return resolve(true);
  });
}

(async () => await importSnapshot())();
