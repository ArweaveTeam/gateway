import fs from 'fs';
import {config} from 'dotenv';
import {indices} from '../utility/order.utility';
import {connection} from '../database/connection.database';
import {transactionFields} from '../database/transaction.database';
import {from as copyFrom} from 'pg-copy-streams';

config();

export async function importBlocks(path: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const encoding = '(FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL("height"))';
      const stream = connection.query(`COPY blocks ("id", "previous_block", "mined_at", "height", "txs", "extended") FROM STDIN WITH ${encoding}`);
      const fileStream = fs.createReadStream(path);
      fileStream.on('error', reject);
      fileStream.pipe(stream).on('finish', resolve).on('error', reject);
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
      const stream = connection.query(`COPY transactions (${fields.join(',')}) FROM STDIN WITH ${encoding}`);
      const fileStream = fs.createReadStream(path);
      fileStream.on('error', reject);
      fileStream.pipe(stream).on('finish', resolve).on('error', reject);

    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTags(path: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const encoding = '(FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL(index))';
      const stream = connection.query(`COPY tags ("tx_id", "index", "name", "value") FROM STDIN WITH ${encoding}`);
      const fileStream = fs.createReadStream(path);
      fileStream.on('error', reject);
      fileStream.pipe(stream).on('finish', resolve).on('error', reject);

    } catch (error) {
      return reject(error);
    }
  });
}
