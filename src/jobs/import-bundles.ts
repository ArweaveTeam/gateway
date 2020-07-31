import Knex from "knex";
import {
  TransactionHeader,
  fetchTransactionData,
  DataBundleWrapper,
  getTagValue,
} from "../lib/arweave";
import log from "../lib/log";
import {
  saveBundleStatus,
  getBundleImport,
} from "../database/bundle-import-db";
import { createQueueHandler, getQueueUrl, enqueue } from "../lib/queues";
import { ImportBundle } from "../interfaces/messages";
import {
  getConnectionPool,
  initConnectionPool,
  releaseConnectionPool,
} from "../database/postgres";
import { streamToJson, fromB64Url } from "../lib/encoding";
import { wait } from "../lib/helpers";
import { saveBundleDataItem } from "../database/transaction-db";
import { put } from "../lib/buckets";

const MAX_RETRY = 10;
const RETRY_BACKOFF_SECONDS = 30;

export const handler = createQueueHandler<ImportBundle>(
  getQueueUrl("import-bundles"),
  async ({ tx }) => {
    log.info(`[import-bundles] importing tx bundles`, { id: tx.id });
    const pool = getConnectionPool("write");

    const { attempts } = await getBundleImport(pool, tx.id);

    const incrementedAttempts = (attempts || 0) + 1;

    const { stream } = await fetchTransactionData(tx.id);

    if (stream) {
      const data = await streamToJson<DataBundleWrapper>(stream);
      try {
        await Promise.all(
          data.items.map(async (item) => {
            const contentType = getTagValue(item.tags, "content-type");
            await saveBundleDataItem(pool, item, { parent: tx.id });
            await put("tx-data", `tx/${item.id}`, fromB64Url(item.data), {
              contentType,
              tags: item.tags,
            });
          })
        );
      } catch (error) {
        log.error(error);
        retry(pool, tx, { attempts: incrementedAttempts });
      }
    } else {
      retry(pool, tx, { attempts: incrementedAttempts });
    }
  },
  {
    before: async () => {
      log.info(`[import-bundles] handler:before database connection init`);
      initConnectionPool("write");
    },
    after: async () => {
      log.info(`[import-bundles] handler:after database connection cleanup`);
      await releaseConnectionPool("write");
    },
  }
);

const retry = async (
  connection: Knex,
  tx: TransactionHeader,
  { attempts }: { attempts: number }
) => {
  if (attempts && attempts >= MAX_RETRY) {
    await saveBundleStatus(connection, [
      {
        id: tx.id,
        status: "error",
        attempts,
      },
    ]);
  } else {
    await Promise.all([
      saveBundleStatus(connection, [
        {
          id: tx.id,
          status: "pending",
          attempts,
        },
      ]),
      enqueue<ImportBundle>(
        getQueueUrl("import-bundles"),
        { tx },
        { delaySeconds: attempts * RETRY_BACKOFF_SECONDS }
      ),
    ]);
  }
};
