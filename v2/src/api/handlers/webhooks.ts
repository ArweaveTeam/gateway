// // import { TransactionHeader, Block } from "../../../lib/arweave";
// // import { enqueue, getQueueUrl } from "../../../lib/queues";
// import { pick } from "lodash";
// // import { ImportTx, ImportBlock } from "../../../interfaces/messages";
// import { RequestHandler } from "express";
// import { ImportBlock, ImportTx } from "../../queue/messages";
// import { Block, TransactionHeader } from "../../arweave/interfaces";
// import createHttpError from "http-errors";

// export const handler: RequestHandler = async (req, res, next) => {
//   if (
//     process.env.WEBHOOK_TOKEN &&
//     process.env.WEBHOOK_TOKEN != req.query.token
//   ) {
//     console.log(`[webhook] invalid webhook token provided ${req.query.token}`);
//     // SImply return a 404 rather than a more detailed error for this endpoint
//     // as it's not intended to be public.
//     throw createHttpError(404);
//   }

//   const {
//     transaction,
//     block,
//   }: { transaction: TransactionHeader; block: Block } = req.body;

//   if (!transaction && !block) {
//     throw createHttpError(400);
//   }

//   if (transaction) {
//     console.log(`[webhook] importing transaction header`, {
//       id: transaction.id,
//     });
//     await importTx(transaction);
//     return res.sendStatus(200).end();
//   }

//   if (block) {
//     console.log(`[webhook] importing block`, { id: block.indep_hash });
//     await importBlock({
//       block,
//     });
//     return res.sendStatus(200).end();
//   }
//   console.log(`[webhook] no valid payload provided`);
//   throw new BadRequest();
// };

// const importTx = async (tx: TransactionHeader): Promise<void> => {
//   let dataSize = tx.data_size || 0;
//   return enqueue<ImportTx>(getQueueUrl("import-txs"), {
//     tx: pick(
//       {
//         ...tx,
//         data_size: tx.data_size || dataSize,
//         data_tree: tx.data_tree || [],
//         data_root: tx.data_root || "",
//         format: tx.format || 1,
//       },
//       [
//         "format",
//         "id",
//         "signature",
//         "owner",
//         "target",
//         "reward",
//         "last_tx",
//         "tags",
//         "quantity",
//         "data_size",
//         "data_root",
//       ]
//     ),
//   });
// };

// const importBlock = async ({ source, block }: ImportBlock): Promise<void> => {
//   await enqueue<ImportBlock>(
//     getQueueUrl("import-blocks"),
//     {
//       source: source,
//       block: pick(block, [
//         "nonce",
//         "previous_block",
//         "timestamp",
//         "last_retarget",
//         "diff",
//         "height",
//         "hash",
//         "indep_hash",
//         "txs",
//         "tx_root",
//         "wallet_list",
//         "reward_addr",
//         "reward_pool",
//         "weave_size",
//         "block_size",
//         "cumulative_diff",
//         "hash_list_merkle",
//       ]),
//     },
//     {
//       messagegroup: `source:${source}`,
//       deduplicationId: `source:${source}/${Date.now()}`,
//     }
//   );
// };
