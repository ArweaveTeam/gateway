import { parseJsonBody, createApiHandler } from "../lib/api-handler";
import { put } from "../lib/buckets";
import { fromB64Url } from "../lib/encoding";
import { Transaction, getTagValue } from "../lib/arweave";
import { enqueue, getQueueUrl } from "../lib/queues";
import { pick } from "lodash";
import { TxEvent } from "../interfaces/messages";

export const handler = createApiHandler(async (request, response) => {
  console.log("Creating handler new-tx");
  const tx = parseJsonBody<Transaction>(request);
  const dataBuffer = fromB64Url(tx.data);

  await put("tx-data", tx.id, dataBuffer, {
    contentType: getTagValue(tx, "content-type")
  });

  await enqueue<TxEvent>(getQueueUrl("tx-dispatch"), {
    event: "gossip",
    data_size: dataBuffer.byteLength,
    tx: pick(tx, [
      "id",
      "signature",
      "owner",
      "target",
      "reward",
      "last_tx",
      "tags",
      "quantity"
    ])
  });
  response.sendStatus(200);
});
