import { fromB64Url } from "../../../lib/encoding";
import { Chunk } from "../../../lib/arweave";
import { enqueue, getQueueUrl } from "../../../lib/queues";
import { pick } from "lodash";
import { ImportChunk } from "../../../interfaces/messages";
import { RequestHandler } from "express";
import { put } from "../../../lib/buckets";

export const handler: RequestHandler = async (req, res, next) => {
  const chunk: Chunk = req.body;

  const chunkData = fromB64Url(chunk.chunk);

  req.log.info(`[new-chunk] received new chunk`, {
    ...chunk,
    chunk: chunk.chunk && chunk.chunk.substr(0, 100) + "...",
  });

  await put("tx-data", `chunks/${chunk.data_root}/${chunk.offset}`, chunkData, {
    contentType: "application/octet-stream",
  });

  await enqueue<ImportChunk>(getQueueUrl("import-chunks"), {
    size: chunkData.byteLength,
    header: pick(chunk, ["data_root", "data_size", "data_path", "offset"]),
  });

  res.sendStatus(200);
};
