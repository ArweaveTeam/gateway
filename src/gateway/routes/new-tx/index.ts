import { put } from "../../../lib/buckets";
import { fromB64Url } from "../../../lib/encoding";
import { Transaction, getTagValue } from "../../../lib/arweave";
import { enqueue, getQueueUrl } from "../../../lib/queues";
import { pick } from "lodash";
import {
  ImportTx,
  DispatchTx,
  DataFormatVersion,
} from "../../../interfaces/messages";
import { RequestHandler } from "express";
import { BadRequest } from "http-errors";
import { broadcastTx } from "../../../lib/broadcast";

import Joi, { Schema } from "@hapi/joi";
import { parseInput } from "../../middleware/validate-body";

export const txSchema: Schema = Joi.object({
  id: Joi.string()
    .required()
    .regex(/^[a-zA-Z0-9_-]{43}$/),
  owner: Joi.string().required(),
  signature: Joi.string().required(),
  reward: Joi.string()
    .regex(/[0-9]*/)
    .required(),
  last_tx: Joi.string().optional().allow("").default(""),
  target: Joi.string().optional().allow("").default(""),
  quantity: Joi.string()
    .regex(/[0-9]*/)
    .optional()
    .allow("")
    .default(""),
  data: Joi.string().optional().allow("").default(""),
  tags: Joi.array()
    .optional()
    .items(
      Joi.object({
        name: Joi.string().required().allow("").default(""),
        value: Joi.string().required().allow("").default(""),
      })
    )
    .default([]),
  format: Joi.number().optional().default(1),
  data_root: Joi.string().optional().allow("").default(""),
  data_size: Joi.string()
    .regex(/[0-9]*/)
    .optional()
    .default(""),
  data_tree: Joi.array().items(Joi.string()).optional().default([]),
});

const dispatchQueueUrl = getQueueUrl("dispatch-txs");
const importQueueUrl = getQueueUrl("import-txs");

export const handler: RequestHandler<{}, {}, Transaction> = async (
  req,
  res
) => {
  const tx = parseInput<Transaction>(txSchema, req.body);

  req.log.info(`[new-tx] Redirection to amplify gateway init`);

  await broadcastTx(tx, [process.env.AMPLIFY_GATEWAY_URL as string]);

  req.log.info(`[new-tx]`, {
    ...tx,
    data: tx.data && tx.data.substr(0, 100) + "...",
  });

  const dataSize = getDataSize(tx);

  req.log.info(`[new-tx] data_size: ${dataSize}`);

  if (dataSize > 0) {
    const dataBuffer = fromB64Url(tx.data);

    if (dataBuffer.byteLength > 0) {
      await put("tx-data", `tx/${tx.id}`, dataBuffer, {
        contentType: getTagValue(tx.tags, "content-type"),
      });
    }
  }

  req.log.info(`[new-tx] queuing for dispatch to network`, {
    id: tx.id,
    queue: dispatchQueueUrl,
  });

  await enqueue<DispatchTx>(dispatchQueueUrl, {
    data_format: getPayloadFormat(tx),
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
    queue: importQueueUrl,
  });

  await enqueue<ImportTx>(importQueueUrl, {
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

  res.sendStatus(200).end();
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

const getPayloadFormat = (tx: Transaction): DataFormatVersion => {
  if (tx.format == 1) {
    return 1;
  }

  if (tx.format == 2) {
    return tx.data && typeof tx.data == "string" && tx.data.length > 0
      ? 2.0
      : 2.1;
  }

  return 1;
};
