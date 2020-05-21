import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { getConnectionPool, releaseConnectionPool } from "../database/postgres";
import { ImportTx } from "../interfaces/messages";
import { fetchTransactionHeader } from "../lib/arweave";
import { hasTx, saveTx, getTx } from "../database/transaction-db";

const pool = getConnectionPool("write");

export const handler = createQueueHandler<ImportTx>(
  getQueueUrl("import-txs"),
  async ({ id, tx }) => {
    console.log(`Importing tx: ${id || (tx && tx.id)}`);

    if (tx) {
      console.log("Tx header: saving");
      return await saveTx(pool, tx);
      console.log("Saved");
    }

    if (id) {
      console.log("Only tx id received");
      const result = await getTx(pool, { id });
      if (result) {
        if (
          result.id &&
          result.signature &&
          result.owner &&
          result.owner_address &&
          result.tags &&
          result.format &&
          result.data_size &&
          result.content_type
        ) {
          console.log("Already has this id");
        } else {
          console.log("Fetching id");
          await saveTx(pool, await fetchTransactionHeader(id));
          console.log("Saved");
          return;
        }
      }
    }
  },
  {
    after: async () => {
      await releaseConnectionPool("write");
    },
  }
);
