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

import Joi, { Schema, ValidationError } from "@hapi/joi";

export const txSchema: Schema = Joi.object({
  id: Joi.string()
    .required()
    .pattern(/^[a-zA-Z0-9_-]{43}$/),
  last_tx: Joi.string().required(),
  owner: Joi.string().required(),
  signature: Joi.string().required(),
  reward: Joi.string().required(),
  target: Joi.string().optional().allow("").default(""),
  quantity: Joi.string().optional().allow("").default(""),
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
  data_size: Joi.string().optional().allow("").default(""),
  data_tree: Joi.array().items(Joi.string()).optional().default([]),
});

const parseInput = <T = any>(schema: Schema, payload: any): T => {
  try {
    return Joi.attempt(payload, txSchema, { abortEarly: false });
  } catch (error) {
    const report: ValidationError = error;
    throw new BadRequest({
      // We only want to expose the message and path, so ignore the other fields
      validation: report.details.map(({ message, path }) => ({
        message,
        path,
      })),
    } as any);
  }
};

export const handler: RequestHandler = async (req, res, next) => {
  const tx = parseInput<Transaction>(txSchema, req.body);

  req.log.info(`[new-tx]`, {
    ...tx,
    byteLength: req.body.byteLength,
    data: tx.data && tx.data.substr(0, 100) + "...",
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

const getPayloadFormat = (tx: Transaction): DataFormatVersion => {
  const dataSize = getDataSize(tx);

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
