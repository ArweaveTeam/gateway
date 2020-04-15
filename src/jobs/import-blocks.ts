import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { createConnectionPool, upsert } from "../lib/postgres";
import { ImportBlock } from "../interfaces/messages";
import knex from "knex";
import { pick } from "lodash";
import moment from "moment";

let pool: knex;
export const handler = createQueueHandler<ImportBlock>(
  getQueueUrl("import-blocks"),
  async ({ block, source }) => {
    console.log(`message:`, block);
    console.log(`source:`, source);
    console.log(`indexing: ${block.indep_hash}`);

    await pool.transaction(async (knexTransaction) => {
      try {
        await Promise.all([
          upsert(knexTransaction, {
            table: "blocks",
            conflictKeys: ["id", "source"],
            rows: [blockToRow({ block, source })],
          }),
        ]);
      } catch (error) {
        console.error(block.indep_hash, error);
        console.log(await knexTransaction.rollback(error));
      }
    });
  },
  {
    before: async () => {
      pool = createConnectionPool("write");
    },
    after: async () => {
      await pool.destroy();
    },
  }
);

const blockToRow = ({ block, source }: ImportBlock) => {
  return pick(
    {
      ...block,
      source,
      id: block.indep_hash,
      txs: JSON.stringify(block.txs),
      timestamp: moment(block.timestamp * 1000).format(),
      meta: JSON.stringify(
        pick(block, [
          "diff",
          "hash",
          "reward_addr",
          "reward_pool",
          "weave_size",
          "block_size",
          "cumulative_diff",
          "hash_list_merkle",
          "tags",
        ])
      ),
    },
    ["id", "previous_block", "timestamp", "height", "txs", "meta", "source"]
  );
};
