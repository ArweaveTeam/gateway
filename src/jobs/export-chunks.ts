import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { get } from "../lib/buckets";
import { broadcastChunk } from "../lib/broadcast";
import { ExportChunk } from "../interfaces/messages";
import { toB64url } from "../lib/encoding";
import { completedExport } from "../database/chunk-db";
import {
  getConnectionPool,
  releaseConnectionPool,
  initConnectionPool,
} from "../database/postgres";
import { wait } from "../lib/helpers";
import log from "../lib/log";

export const hosts = JSON.parse(
  process.env.ARWEAVE_NODES || "null"
) as string[];

export const handler = createQueueHandler<ExportChunk>(
  getQueueUrl("export-chunks"),
  async (message) => {
    const { header } = message;

    log.info(`[export-chunks] exporting chunk`, {
      data_root: header.data_root,
      offset: header.offset,
    });

    const fullChunk = {
      ...header,
      chunk: toB64url(
        (await get("tx-data", `chunks/${header.data_root}/${header.offset}`))
          .Body as Buffer
      ),
    };

    await broadcastChunk(fullChunk, hosts);

    const pool = getConnectionPool("write");

    await completedExport(pool, {
      data_size: header.data_size,
      data_root: header.data_root,
      offset: header.offset,
    });
  },
  {
    before: async () => {
      log.info(`[export-chunks] handler:before database connection init`);
      initConnectionPool("write");
      await wait(100);
    },
    after: async () => {
      log.info(`[export-chunks] handler:after database connection cleanup`);
      await releaseConnectionPool("write");
      await wait(100);
    },
  }
);
