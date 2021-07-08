import fs from "fs";
import { PoolClient } from "pg";
import { config } from "dotenv";
import { indices } from "../utility/order.utility";
import { pgConnection } from "../database/connection.database";
import { transactionFields } from "../database/transaction.database";
import { from as copyFrom } from "pg-copy-streams";

config();

export async function importBlocks(path: string) {
  return new Promise(async (resolve, reject) => {
    let client: PoolClient;
    try {
      client = await pgConnection.connect();
      const encoding =
        "(FORMAT CSV, HEADER, ESCAPE '\\', DELIMITER '|', FORCE_NULL(\"height\"))";
      const stream = client.query(
        copyFrom(
          `COPY blocks ("id", "previous_block", "mined_at", "height", "txs", "extended") FROM STDIN WITH ${encoding}`
        )
      );
      const fileStream = fs.createReadStream(path);
      fileStream.on("error", reject);
      fileStream
        .pipe(stream)
        .on("finish", () => {
          client.release();
          resolve(true);
        })
        .on("error", (err) => {
          client.release();
          reject(err);
        });
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTransactions(path: string) {
  return new Promise(async (resolve, reject) => {
    let client: PoolClient;
    try {
      client = await pgConnection.connect();
      const fields = transactionFields
        .concat(indices)
        .map((field) => `"${field}"`);

      const encoding =
        '(FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL("format", "height", "data_size"))';
      const stream = client.query(
        copyFrom(
          `COPY transactions (${fields.join(",")}) FROM STDIN WITH ${encoding}`
        )
      );
      const fileStream = fs.createReadStream(path);
      fileStream.on("error", () => {
        client.release();
        reject();
      });
      fileStream
        .pipe(stream)
        .on("finish", () => {
          client.release();
          resolve(true);
        })
        .on("error", (err) => {
          client.release();
          reject(err);
        });
    } catch (error) {
      return reject(error);
    }
  });
}

export async function importTags(path: string) {
  return new Promise(async (resolve, reject) => {
    let client: PoolClient;
    try {
      client = await pgConnection.connect();
      const encoding =
        "(FORMAT CSV, HEADER, ESCAPE '\\', DELIMITER '|', FORCE_NULL(index))";
      const stream = client.query(
        copyFrom(
          `COPY tags ("tx_id", "index", "name", "value") FROM STDIN WITH ${encoding}`
        )
      );
      const fileStream = fs.createReadStream(path);
      fileStream.on("error", () => {
        client.release();
        reject();
      });
      fileStream
        .pipe(stream)
        .on("finish", () => {
          client.release();
          resolve(true);
        })
        .on("error", (err) => {
          client.release();
          reject(err);
        });
    } catch (error) {
      return reject(error);
    }
  });
}
