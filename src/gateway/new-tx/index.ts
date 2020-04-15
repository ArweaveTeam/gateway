import { parseJsonBody, createApiHandler, router } from "../../lib/api-handler";
import { put } from "../../lib/buckets";
import { fromB64Url } from "../../lib/encoding";
import { Transaction, getTagValue } from "../../lib/arweave";
import { enqueue, getQueueUrl } from "../../lib/queues";
import { pick } from "lodash";
import { ImportTx } from "../../interfaces/messages";

const app = router();

app.post(
  "*",
  createApiHandler(async (request, response) => {
    console.log("received new transaction");

    const tx = parseJsonBody<Transaction>(request);

    console.log(`id: ${tx.id}`);

    const dataBuffer = fromB64Url(tx.data);

    await put("tx-data", `tx/${tx.id}`, dataBuffer, {
      contentType: getTagValue(tx, "content-type"),
    });

    let contentType = getTagValue(tx, "content-type") || null;

    await enqueue<ImportTx>(getQueueUrl("dispatch-txs"), {
      data_size: tx.data_size,
      content_type: contentType,
      tx: pick(tx, [
        "format",
        "id",
        "signature",
        "owner",
        "target",
        "reward",
        "last_tx",
        "tags",
        "quantity",
        "data_size",
        "data_tree",
        "data_root",
      ]),
    });

    await enqueue<ImportTx>(getQueueUrl("import-txs"), {
      data_size: tx.data_size,
      content_type: contentType,
      tx: pick(tx, [
        "format",
        "id",
        "signature",
        "owner",
        "target",
        "reward",
        "last_tx",
        "tags",
        "quantity",
        "data_size",
        "data_tree",
        "data_root",
      ]),
    });

    response.sendStatus(200);
  })
);

export const handler = async (event: any, context: any) => {
  return app.run(event, context);
};
