import Knex from "knex";
import {
  TransactionHeader,
  fetchTransactionData,
  DataBundleWrapper,
  getTagValue,
  DataBundleItem,
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
import { wait, sequentialBatch } from "../lib/helpers";
import { saveBundleDataItem } from "../database/transaction-db";
import { put } from "../lib/buckets";

const MAX_RETRY = 10;
const RETRY_BACKOFF_SECONDS = 30;

export const handler = createQueueHandler<ImportBundle>(
  getQueueUrl("import-bundles"),
  async ({ header }) => {
    const pool = getConnectionPool("write");

    const { attempts = 0 } = await getBundleImport(pool, header.id);

    const incrementedAttempts = attempts + 1;

    log.info("[import-bundles] importing tx bundle", {
      attempt: incrementedAttempts,
      bundle: header.id,
    });

    const { stream } = await fetchTransactionData(header.id);

    if (stream) {
      const data = await streamToJson<DataBundleWrapper>(stream);

      try {
        await sequentialBatch(
          data.items,
          10,
          async (items: DataBundleItem[]) => {
            await Promise.all(
              items.map(async (item) => {
                const contentType = getTagValue(item.tags, "content-type");

                const bundleData = fromB64Url(item.data);

                log.info("[import-bundles] importing tx bundle item", {
                  attempts,
                  bundle: header.id,
                  item: item.id,
                  contentType,
                  contentLength: bundleData.byteLength,
                });

                await saveBundleDataItem(pool, item, { parent: header.id });

                await put("tx-data", `tx/${item.id}`, bundleData, {
                  contentType,
                });
              })
            );
          }
        );

        await complete(pool, header.id, { attempts });
      } catch (error) {
        log.error("error", error?.message);
        retry(pool, header, { attempts: incrementedAttempts });
      }
    } else {
      log.error("Data not available, requeuing");
      retry(pool, header, { attempts: incrementedAttempts });
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
  { attempts }: { attempts: number }
) => {
  if (attempts && attempts >= MAX_RETRY) {
    return saveBundleStatus(connection, [
      {
        id: header.id,
        status: "error",
        attempts,
      },
    ]);
  }
  return Promise.all([
    saveBundleStatus(connection, [
      {
        id: header.id,
        status: "pending",
        attempts,
      },
    ]),
    enqueue<ImportBundle>(
      getQueueUrl("import-bundles"),
      { header },
      { delaySeconds: attempts * RETRY_BACKOFF_SECONDS }
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
    },
  ]);
};
