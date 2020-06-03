import { getQueueUrl, createQueueHandler } from "../lib/queues";
import {
  getConnectionPool,
  releaseConnectionPool,
  initConnectionPool,
} from "../database/postgres";
import { ImportTx } from "../interfaces/messages";
import { fetchTransactionHeader } from "../lib/arweave";
import { saveTx, getTx } from "../database/transaction-db";
import { wait } from "../lib/helpers";
import log from "../lib/log";

export const handler = createQueueHandler<ImportTx>(
  getQueueUrl("import-txs"),
  async ({ id, tx }) => {
    const pool = getConnectionPool("write");

    if (tx) {
      log.info(`[import-txs] importing tx header`, { id });
      await saveTx(pool, tx);
      log.info(`[import-txs] successfully saved`, { id });
      return;
    }

    if (id) {
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
          log.info(`[import-txs] transaction already exists`, { id });
        } else {
          log.info(`[import-txs] fetching tx header`, { id });
          await saveTx(pool, await fetchTransactionHeader(id));
          log.info(`[import-txs] successfully saved`, { id });
        }
      }
    }
  },
  {
    before: async () => {
      log.info(`[import-txs] handler:before database connection init`);
      initConnectionPool("write");
      await wait(500);
    },
    after: async () => {
      log.info(`[import-txs] handler:after database connection cleanup`);
      await releaseConnectionPool("write");
      await wait(500);
    },
  }
);
