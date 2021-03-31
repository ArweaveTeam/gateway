import {config} from 'dotenv';
import {indices} from '../utility/order.utility';
import {connection} from '../database/connection.database';
import {transactionFields} from '../database/transaction.database';

config();

export async function importBlocks(path: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const encoding = '(FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL("height"))';
      await connection.raw(`COPY blocks ("id", "previous_block", "mined_at", "height", "txs", "extended") FROM '${path}' WITH ${encoding}`);

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTransactions(path: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const fields = transactionFields
          .concat(indices)
          .map((field) => `"${field}"`);

      const encoding = '(FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL("format", "height", "data_size"))';
      await connection.raw(`COPY transactions (${fields.join(',')}) FROM '${path}' WITH ${encoding}`);

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTags(path: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const encoding = '(FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL(index))';
      await connection.raw(`COPY tags ("tx_id", "index", "name", "value") FROM '${path}' WITH ${encoding}`);

      return resolve(true);
    } catch (error) {
      return reject(error);
    }
  });
}
