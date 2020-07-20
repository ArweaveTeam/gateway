import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { ImportChunk } from "../interfaces/messages";
import { saveChunk } from "../database/chunk-db";
import {
  getConnectionPool,
  initConnectionPool,
  releaseConnectionPool,
} from "../database/postgres";
import log from "../lib/log";
import { wait } from "../lib/helpers";

export const handler = createQueueHandler<ImportChunk>(
  getQueueUrl("import-chunks"),
  async ({ header, size }) => {
    const pool = getConnectionPool("write");
    log.info(`[import-chunks] importing chunk`, {
      root: header.data_root,
      size: size,
    });
    await saveChunk(pool, {
      ...header,
      chunk_size: size,
    });
  },
  {
    before: async () => {
      log.info(`[import-chunks] handler:before database connection init`);
      initConnectionPool("write");
      await wait(500);
    },
    after: async () => {
      log.info(`[import-chunks] handler:after database connection cleanup`);
      await releaseConnectionPool("write");
      await wait(500);
    },
  }
);
