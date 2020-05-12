import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { getConnectionPool, releaseConnectionPool } from "../database/postgres";
import { ImportTx } from "../interfaces/messages";
import { fetchTransactionHeader } from "../lib/arweave";
import { hasTx, saveTx } from "../database/transaction-db";

export const handler = createQueueHandler<ImportTx>(
  getQueueUrl("import-txs"),
  async ({ id, tx }) => {
    console.log(`Importing tx: ${id || (tx && tx.id)}`);

    const pool = getConnectionPool("write");

    if (tx) {
      if (!(await hasTx(pool, tx.id))) {
        console.log(`Saving new tx: ${tx.id}`);
        return await saveTx(pool, tx);
      }
    }

    if (id) {
      if (!(await hasTx(pool, id))) {
        console.log(`Fetching and saving new tx: ${id}`);
        return await saveTx(pool, await fetchTransactionHeader(id));
      }
    }
  },
  {
    after: async () => {
      await releaseConnectionPool("write");
    },
  }
);
