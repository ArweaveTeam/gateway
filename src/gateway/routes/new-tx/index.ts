import { put } from "../../../lib/buckets";
import { fromB64Url } from "../../../lib/encoding";
import { Transaction, getTagValue } from "../../../lib/arweave";
import { enqueue, getQueueUrl } from "../../../lib/queues";
import { pick } from "lodash";
import { ImportTx, DispatchTx } from "../../../interfaces/messages";
import { RequestHandler } from "express";

export const handler: RequestHandler = async (req, res, next) => {
  console.log("received new transaction");

  const { tx }: { tx: Transaction } = req.body;

  console.log(`id: ${tx.id}`);

  const dataBuffer = fromB64Url(tx.data);

  await put("tx-data", `tx/${tx.id}`, dataBuffer, {
    contentType: getTagValue(tx, "content-type"),
  });

  await enqueue<DispatchTx>(getQueueUrl("dispatch-txs"), {
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

  res.sendStatus(200);
};
