import Knex from "knex";
import {
  TransactionHeader,
  fetchTransactionData,
  DataBundleWrapper,
  getTagValue,
  DataBundleItem,
  fetchTransactionHeader,
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
import { sequentialBatch } from "../lib/helpers";
import { saveBundleDataItems } from "../database/transaction-db";
import { put } from "../lib/buckets";

const MAX_RETRY = 9;
const RETRY_BACKOFF_SECONDS = 300;

export const handler = createQueueHandler<ImportBundle>(
  getQueueUrl("import-bundles"),
  async ({ header, id }) => {
    log.info({ header, id });
    log.info("[import-bundles] importing tx bundle", {
      bundle: {
        id,
        tx: header?.id,
      },
    });

    const pool = getConnectionPool("write");

    const tx = header ? header : await fetchTransactionHeader(id || "");

    const { attempts = 0 } = await getBundleImport(pool, tx.id);

    log.info("[import-bundles] importing tx bundle status", {
      bundle: {
        id: tx.id,
        attempts,
      },
    });

    const incrementedAttempts = attempts + 1;

    const { stream } = await fetchTransactionData(tx.id);

    if (stream) {
      const data = await streamToJson<DataBundleWrapper>(stream);

      try {
        await validate(data);
      } catch (error) {
        log.error("error", { id: tx.id, error });
        await invalid(pool, tx.id, {
          attempts: incrementedAttempts,
          error: error.message,
        });
        return;
      }

      try {
        await Promise.all([
          sequentialBatch(data.items, 200, async (items: DataBundleItem[]) => {
            await Promise.all(
              items.map(async (item) => {
                const contentType = getTagValue(item.tags, "content-type");

                const bundleData = fromB64Url(item.data);

                await put("tx-data", `tx/${item.id}`, bundleData, {
                  contentType,
                });
              })
            );
          }),
          sequentialBatch(data.items, 100, async (items: DataBundleItem[]) => {
            await saveBundleDataItems(pool, tx.id, items);
          }),
        ]);
        await complete(pool, tx.id, { attempts: incrementedAttempts });
      } catch (error) {
        log.error("error", error);
        await retry(pool, tx, {
          attempts: incrementedAttempts,
          error: error.message + error.stack || "",
        });
      }
    } else {
      log.error("Data not available, requeuing");
      await retry(pool, tx, {
        attempts: incrementedAttempts,
        error: "Data not yet available",
      });
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
  header: TransactionHeader,
  { attempts, error }: { attempts: number; error?: any }
) => {
  if (attempts && attempts >= MAX_RETRY + 1) {
    return saveBundleStatus(connection, [
      {
        id: header.id,
        status: "error",
        attempts,
        error,
      },
    ]);
  }
  const delay = attempts * RETRY_BACKOFF_SECONDS;
  return Promise.all([
    saveBundleStatus(connection, [
      {
        id: header.id,
        status: "pending",
        attempts,
        error: error || null,
      },
    ]),
    enqueue<ImportBundle>(
      getQueueUrl("import-bundles"),
      { header },
      { delaySeconds: Math.min(delay, 900) }
    ),
  ]);
};

const complete = async (
  connection: Knex,
  id: string,
  { attempts }: { attempts: number }
) => {
  await saveBundleStatus(connection, [
    {
      id,
      status: "complete",
      attempts,
      error: null,
    },
  ]);
};

const invalid = async (
  connection: Knex,
  id: string,
  { attempts, error }: { attempts: number; error?: string }
) => {
  await saveBundleStatus(connection, [
    {
      id,
      status: "invalid",
      attempts,
      error: error || null,
    },
  ]);
};

const validate = (bundle: { items: DataBundleItem[] }) => {
  bundle.items.forEach((item) => {
    const fields = Object.keys(item);
    const requiredFields = ["id", "owner", "signature", "data"];
    requiredFields.forEach((requiredField) => {
      if (!fields.includes(requiredField)) {
        throw new Error(
          `Invalid bundle detected, missing required field: ${requiredField}`
        );
      }
    });
  });
};
