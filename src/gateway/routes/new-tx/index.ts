import { put } from "../../../lib/buckets";
import { fromB64Url } from "../../../lib/encoding";
import { Transaction, getTagValue } from "../../../lib/arweave";
import { enqueue, getQueueUrl } from "../../../lib/queues";
import { pick } from "lodash";
import { ImportTx, DispatchTx } from "../../../interfaces/messages";
import { RequestHandler } from "express";
import { BadRequest } from "http-errors";

export const handler: RequestHandler = async (req, res, next) => {
  const tx: Transaction = req.body;

  if (!tx.id) {
    req.log.warn(`[new-tx] invalid request, missing id`);
    throw new BadRequest("midding param: id");
  }

  req.log.info(`[new-tx]`, {
    byteLength: req.body.byteLength,
    id: tx.id,
    data: tx.data && tx.data.substr(0, 100) + "...",
    tags: tx.tags && tx.tags.length,
    last_tx: tx.last_tx && tx.last_tx,
    owner: tx.owner && tx.owner,
    target: tx.target && tx.target,
    quantity: tx.quantity && tx.quantity,
    reward: tx.reward && tx.reward,
    signature: tx.signature && tx.signature,
    data_root: tx.data_root && tx.data_root,
    data_size: tx.data_size && tx.data_size,
  });

  const dataSize = getDataSize(tx);

  req.log.info(`[new-tx] data_size: ${dataSize}`);

  if (dataSize > 0) {
    const dataBuffer = fromB64Url(tx.data);

    await put("tx-data", `tx/${tx.id}`, dataBuffer, {
      contentType: getTagValue(tx.tags, "content-type"),
    });
  }

  req.log.info(`[new-tx] queuing for dispatch to network`, {
    id: tx.id,
    queue: getQueueUrl("dispatch-txs"),
  });

  await enqueue<DispatchTx>(getQueueUrl("dispatch-txs"), {
    data_size: dataSize,
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

  req.log.info(`[new-tx] queuing for import`, {
    id: tx.id,
    queue: getQueueUrl("import-txs"),
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

const getDataSize = (tx: Transaction) => {
  if (tx.data_size) {
    return tx.data_size;
  }
  if (tx.data == "") {
    return 0;
  }

  try {
    return fromB64Url(tx.data).byteLength;
  } catch (error) {
    console.error(error);
    throw new BadRequest();
  }
};
