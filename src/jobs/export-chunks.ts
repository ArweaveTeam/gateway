import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { get } from "../lib/buckets";
import { broadcastChunk } from "../lib/broadcast";
import { ExportChunk } from "../interfaces/messages";
import { toB64url } from "../lib/encoding";

export const hosts = JSON.parse(
  process.env.ARWEAVE_NODES || "null"
) as string[];

export const handler = createQueueHandler<ExportChunk>(
  getQueueUrl("export-chunks"),
  async (message) => {
    const { header, size: chunkSize } = message;

    const fullChunk = {
      ...header,
      chunk: toB64url(
        (await get("tx-data", `chunks/${header.data_root}/${header.offset}`))
          .Body as Buffer
      ),
    };

    await broadcastChunk(fullChunk, hosts);
  }
);
