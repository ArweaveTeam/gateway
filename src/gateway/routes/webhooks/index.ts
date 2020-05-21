import { TransactionHeader, Block } from "../../../lib/arweave";
import { enqueue, getQueueUrl } from "../../../lib/queues";
import { pick } from "lodash";
import { ImportTx, ImportBlock } from "../../../interfaces/messages";
import { RequestHandler } from "express";

export const handler: RequestHandler = async (req, res, next) => {
  console.log("Creating handler new-tx", req.body);

  const {
    transaction,
    block,
  }: { transaction: TransactionHeader; block: Block } = req.body;

  if (transaction) {
    console.log("Payload contains tx, importing...");
    await importTx(transaction);
    return res.sendStatus(200);
  }

  if (block) {
    console.log("Payload contains block, importing...");
    await importBlock({
      block,
      source: req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"][0]
        : "0.0.0.0",
    });
    return res.sendStatus(200);
  }
};

const importTx = async (tx: TransactionHeader): Promise<void> => {
  let dataSize = tx.data_size || 0;

  return enqueue<ImportTx>(getQueueUrl("import-txs"), {
    tx: pick(
      {
        ...tx,
        data_size: tx.data_size || dataSize,
        data_tree: tx.data_tree || [],
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
        "data_tree",
        "data_root",
      ]
    ),
  });
};

const importBlock = async ({ source, block }: ImportBlock): Promise<void> => {
  await enqueue<ImportBlock>(
    getQueueUrl("import-blocks"),
    {
      source: source,
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
    },
    {
      messagegroup: `source:${source}`,
      deduplicationId: `source:${source}/${Date.now()}`,
    }
  );
};
