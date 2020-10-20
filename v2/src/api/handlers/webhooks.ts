import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { pick } from "lodash";
import { Block, TransactionHeader } from "../../arweave/interfaces";
import { enqueue } from "../../queue";
import { ImportBlock, ImportTx } from "../../queue/interfaces";

export const handler: RequestHandler = async (req, res) => {
  const {
    transaction,
    block,
  }: { transaction?: TransactionHeader; block?: Block } = req.body;

  if (transaction) {
    console.log(`[webhook] importing transaction header`, {
      id: transaction.id,
    });
    await enqueueTx(transaction);
    return res.sendStatus(200);
  }

  if (block) {
    console.log(`[webhook] importing block`, { id: block.indep_hash });
    await enqueueBlock({
      block,
    });
    return res.sendStatus(200);
  }

  console.log(`[webhook] no valid payload provided`);

  throw createHttpError(400);
};

const enqueueTx = async (tx: TransactionHeader): Promise<void> => {
  const messageId = await enqueue<ImportTx>("import-tx", {
    tx: pick(
      {
        ...tx,
        data_size: tx.data_size || "0",
        data_root: tx.data_root || "",
        format: tx.format || 1,
      },
      [
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
        "data_root",
      ]
    ),
  });
  console.log(`Queued: ${messageId}`);
};

const enqueueBlock = async ({ block }: ImportBlock): Promise<void> => {
  const messageId = await enqueue<ImportBlock>("import-block", {
    block: pick(block, [
      "nonce",
      "previous_block",
      "timestamp",
      "last_retarget",
      "diff",
      "height",
      "hash",
      "indep_hash",
      "txs",
      "tx_root",
      "wallet_list",
      "reward_addr",
      "reward_pool",
      "weave_size",
      "block_size",
      "cumulative_diff",
      "hash_list_merkle",
    ]),
  });
  console.log(`Queued: ${messageId}`);
};
