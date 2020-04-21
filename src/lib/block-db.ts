import knex from "knex";
import { Block } from "./arweave";
import { upsert, DBConnection } from "./postgres";
import moment from "moment";
import { pick } from "lodash";
import { transform } from "lodash";

export interface DatabaseBlock {
  id: string;
  previous_block: string;
  timestamp: string;
  height: number;
  txs: string[];
  extended: object;
}

const blockFields = [
  "id",
  "height",
  "timestamp",
  "previous_block",
  "txs",
  "extended",
];

export const getLatestBlock = async (
  connection: knex
): Promise<DatabaseBlock> => {
  const block = await connection
    .select<DatabaseBlock>(blockFields)
    .from("blocks")
    .orderBy("height", "desc")
    .first();

  if (block) {
    return block;
  }

  throw new Error("Failed to get latest block from the block database");
};

export const getBlock = async (
  connection: knex,
  predicate: { height: number } | { id: string }
): Promise<DatabaseBlock | undefined> => {
  return connection.select(blockFields).from("blocks").where(predicate).first();
};

export const getRecentBlocks = async (
  connection: knex
): Promise<DatabaseBlock[]> => {
  return connection
    .select<DatabaseBlock[]>(blockFields)
    .from("blocks")
    .orderBy("height", "desc")
    .limit(200);
};

export const insertBlocks = async (
  connection: DBConnection,
  blocks: DatabaseBlock[]
) => {
  return upsert(connection, {
    table: "blocks",
    conflictKeys: ["height"],
    rows: blocks.map(serialize),
  });
};

export const fullBlocksToDbBlocks = (blocks: Block[]): DatabaseBlock[] => {
  return blocks.map(fullBlockToDbBlock);
};
/**
 * Format a full block into a stripped down version for storage in the postgres DB.
 */
export const fullBlockToDbBlock = (block: Block): DatabaseBlock => {
  return pick(
    {
      ...block,
      id: block.indep_hash,
      txs: block.txs,
      // moment expects millisecond precision timestamps, so we need to
      // upscale our plain old second precision timestamp.
      timestamp: moment(block.timestamp * 1000).format(),
      extended: pick(block, [
        "diff",
        "hash",
        "reward_addr",
        "reward_pool",
        "weave_size",
        "block_size",
        "cumulative_diff",
        "hash_list_merkle",
        "tags",
      ]),
    },
    ["id", "previous_block", "timestamp", "height", "txs", "extended"]
  );
};

// The pg driver and knex don't know the destination column types,
// and they don't correctly serialize json fields, so this needs
// to be done manually.
const serialize = (row: DatabaseBlock): object => {
  return transform(row, (result: any, value: any, key: string) => {
    result[key] =
      value && typeof value == "object" ? JSON.stringify(value) : value;
  });
};
