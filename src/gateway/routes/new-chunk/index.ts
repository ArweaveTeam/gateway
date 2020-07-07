import { fromB64Url } from "../../../lib/encoding";
import { Chunk } from "../../../lib/arweave";
import { enqueue, getQueueUrl } from "../../../lib/queues";
import { pick } from "lodash";
import { ImportChunk } from "../../../interfaces/messages";
import { RequestHandler } from "express";
import { put } from "../../../lib/buckets";
import NodeCryptoDriver from "arweave/node/lib/crypto/node-driver";
import Arweave from "arweave/node";
Arweave.crypto = new NodeCryptoDriver();

import { validatePath } from "arweave/node/lib/merkle";
import { BadRequest } from "http-errors";
import Joi, { Schema, ValidationError } from "@hapi/joi";
import { parseInput } from "../../middleware/validate-body";

// the API defintion uses numeric string instead of numbers,
// Joi.number will accept either number or string and coerce it.
export const chunkSchema: Schema = Joi.object({
  chunk: Joi.string().required(),
  data_size: Joi.number().required().integer(),
  data_root: Joi.string().required(),
  offset: Joi.number().required().integer(),
  data_path: Joi.string().required(),
});

export const handler: RequestHandler = async (req, res, next) => {
  const chunk = parseInput<Chunk>(chunkSchema, req.body);

  req.log.info(`[new-chunk] received new chunk`, {
    ...chunk,
    chunk: chunk.chunk && chunk.chunk.substr(0, 100) + "...",
  });

  const chunkData = parseOrThrow(chunk.chunk, "chunk");

  const dataPath = parseOrThrow(chunk.data_path, "data_path");

  const root = parseOrThrow(chunk.data_root, "data_root");

  const isValid = await validateChunk(
    root,
    chunk.offset,
    chunk.data_size,
    dataPath
  );

  req.log.warn("[new-chunk] validate chunk", {
    isValid,
  });

  if (!isValid) {
    throw new BadRequest("Chunk validation failed");
  }

  await put("tx-data", `chunks/${chunk.data_root}/${chunk.offset}`, chunkData, {
    contentType: "application/octet-stream",
  });

  req.log.warn("[new-chunk] cached successfully");

  await enqueue<ImportChunk>(getQueueUrl("import-chunks"), {
    size: chunkData.byteLength,
    header: pick(chunk, ["data_root", "data_size", "data_path", "offset"]),
  });

  res.sendStatus(200);
};

const parseOrThrow = (b64urlString: string, fieldName: string) => {
  try {
    return fromB64Url(b64urlString);
  } catch (error) {
    throw new BadRequest(`missing field: ${fieldName}`);
  }
};

const validateChunk = async (
  root: Buffer,
  offset: number,
  size: number,
  proof: Buffer
) => {
  try {
    return validatePath(root, offset, 0, size, proof);
  } catch (error) {
    console.warn(error);
    return false;
  }
};
