import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { ImportChunk } from "../interfaces/messages";
import { saveChunk } from "../database/chunk-db";
import { getConnectionPool, initConnectionPool } from "../database/postgres";
import log from "../lib/log";

const pool = initConnectionPool("write");

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
  }
);
