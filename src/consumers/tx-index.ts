import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { publish } from "../lib/pub-sub";
import { createConnection } from "../lib/postgres";
import { TxEvent } from "../interfaces/messages";
import { pick } from "lodash";
import knex from "knex";

let pool: knex;
export const handler = createQueueHandler<TxEvent>(
  getQueueUrl("tx-index"),
  async message => {
    console.log(`message:`, message);
    await pool
      .into("transactions")
      .insert(
        pick(message.tx, [
          "id",
          "owner",
          "target",
          "quantity",
          "reward",
          "signature",
          "last_tx"
        ])
      )
      .catch(error => {
        if (!isDuplicateKey(error)) throw error;
      });

    console.log(`indexing: ${message.tx.id}`);
  },
  {
    before: async () => {
      pool = createConnection("write");
    },
    after: async () => {
      await pool.destroy();
    }
  }
);

const isDuplicateKey = (err: any) => err.code === "23505";
