import Knex from "knex";
import {
  getConnectionPool,
  initConnectionPool,
  releaseConnectionPool,
} from "../database/postgres";
import { getTx, saveTx } from "../database/transaction.query";
import { ImportTx, ImportBundle } from "../interfaces/messages";
import {
  fetchTransactionHeader,
  getTagValue,
  TransactionHeader,
} from "../lib/arweave";
import { wait } from "../lib/helpers";
import log from "../lib/log";
import { createQueueHandler, getQueueChannel, enqueue } from "../lib/queues";
import {
  getBundleImport,
  saveBundleStatus,
} from "../database/bundle-import-db";

export const handler = createQueueHandler<ImportTx>(
  getQueueChannel("import-txs"),
  async ({ id, tx }) => {
    const pool = getConnectionPool("write");

    const header = tx || (await fetchTransactionHeader(id || ""));

    if (tx) {
      log.info(`[import-txs] importing tx header`, { id });
      return await save(pool, tx);
    }

    if (id) {
      return await save(pool, await fetchTransactionHeader(id));
    }

    await handleBundle(pool, header);
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

  log.info(`[import-txs] successfully saved tx header`, { id: tx.id });
};

const handleBundle = async (connection: Knex, tx: TransactionHeader) => {
  if (tx?.data_size > 0 && isBundle(tx)) {
    log.info(`[import-txs] detected data bundle tx`, { id: tx.id });
    const { attempts } = await getBundleImport(connection, tx.id);

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
    log.info(`[import-txs] queuing bundle for import`, { id: tx.id });
    await Promise.all([
      saveBundleStatus(connection, [
        {
          id: tx.id,
          status: "pending",
          attempts: attempts || 0,
        },
      ]),
      enqueue<ImportBundle>(getQueueChannel("import-bundles"), { header: tx }),
    ]);
    log.info(`[import-txs] successfully queued bundle for import`, {
      id: tx.id,
    });
  }
};

const isBundle = (tx: TransactionHeader): boolean => {
  return (
    getTagValue(tx.tags, "content-type") == "application/json" &&
    getTagValue(tx.tags, "bundle-format") == "json" &&
    getTagValue(tx.tags, "bundle-version") == "1.0.0"
  );
};
