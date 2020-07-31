import Knex from "knex";
import {
  getConnectionPool,
  initConnectionPool,
  releaseConnectionPool,
} from "../database/postgres";
import { getTx, saveTx } from "../database/transaction-db";
import { ImportTx, ImportBundle } from "../interfaces/messages";
import {
  fetchTransactionHeader,
  getTagValue,
  TransactionHeader,
} from "../lib/arweave";
import { wait } from "../lib/helpers";
import log from "../lib/log";
import { createQueueHandler, getQueueUrl, enqueue } from "../lib/queues";
import {
  getBundleImport,
  saveBundleStatus,
} from "../database/bundle-import-db";

export const handler = createQueueHandler<ImportTx>(
  getQueueUrl("import-txs"),
  async ({ id, tx }) => {
    const pool = getConnectionPool("write");

    if (tx) {
      log.info(`[import-txs] importing tx header`, { id });
      return await save(pool, tx);
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
          return await save(pool, await fetchTransactionHeader(id));
        }
      }
    }
  },
  {
    before: async () => {
      log.info(`[import-txs] handler:before database connection init`);
      initConnectionPool("write");
    },
    after: async () => {
      log.info(`[import-txs] handler:after database connection cleanup`);
      await releaseConnectionPool("write");
      await wait(500);
    },
  }
);

const save = async (connection: Knex, tx: TransactionHeader) => {
  log.info(`[import-txs] saving tx header`, { id: tx.id });

  await saveTx(connection, tx);

  if (tx?.data_size > 0 && isBundle(tx)) {
    log.info(`[import-txs] detected data bundle tx`, { id: tx.id });
    const { status, attempts } = await getBundleImport(connection, tx.id);

    // A single bundle import will trigger the importing of all the contained txs,
    // This  process will queue all the txs and a consumer will keep polling until the
    // bundle data is available and mined.
    //
    // Ideally we don't want to overdo this as it's quite spammy.
    //
    // For now, we'll only import bundled txs if it's the first time we've seen it,
    // or if it's been seen before but failed to import for whatever reason.
    //
    // When we get tx sync download webhoooks this can be improved.
    if (!status || !["pending", "complete"].includes(status)) {
      log.info(`[import-txs] queuing bundle for import`, { id: tx.id });
      await Promise.all([
        saveBundleStatus(connection, [
          {
            id: tx.id,
            status: "pending",
            attempts: attempts || 0,
          },
        ]),
        enqueue<ImportBundle>(getQueueUrl("import-bundles"), { tx }),
      ]);
      log.info(`[import-txs] successfully queued bundle for import`, {
        id: tx.id,
      });
    }
  }
  log.info(`[import-txs] successfully saved tx header`, { id: tx.id });
};

const isBundle = (tx: TransactionHeader): boolean => {
  return (
    getTagValue(tx.tags, "content-type") == "application/json" &&
    getTagValue(tx.tags, "bundle-format") == "json" &&
    getTagValue(tx.tags, "bundle-version") == "1.0.0"
  );
};
