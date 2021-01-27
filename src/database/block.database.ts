import knex from "knex";
import moment from "moment";
import { pick, transform } from "lodash";

import log from "../lib/log";
import { sequentialBatch } from "../lib/helpers";
import { Block } from "../lib/arweave";
import { upsert, DBConnection } from "./postgres";

export interface DatabaseBlock {
  id: string;
  previous_block: string;
  mined_at: string;
  height: number;
  txs: string[];
  extended: object;
}

export interface DatabaseBlockTxMap {
  block_id: string;
  tx_id: string;
}

interface TxBlockHeight {
  id: string;
  height: number;
}

const blockFields = [
  "id",
  "height",
  "mined_at",
  "previous_block",
  "txs",
  "extended",
];

const extendedFields = [
  "diff",
  "hash",
  "reward_addr",
  "last_retarget",
  "tx_root",
  "tx_tree",
  "reward_pool",
  "weave_size",
  "block_size",
  "cumulative_diff",
  "hash_list_merkle",
  "tags",
];

export async function getLatestBlock(connection: knex): Promise<DatabaseBlock> {
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

export async function getBlock(connection: knex, predicate: { height: number } | { id: string }): Promise<DatabaseBlock | undefined> {
  return connection.select(blockFields).from("blocks").where(predicate).first();
};

export async function getRecentBlocks(connection: knex): Promise<DatabaseBlock[]> {
  return connection
    .select<DatabaseBlock[]>(blockFields)
    .from("blocks")
    .orderBy("height", "desc")
    .limit(200);
};

export async function saveBlocks(connection: DBConnection, blocks: DatabaseBlock[]) {
  return connection.transaction(async knexTransaction => {
    await upsert(connection, {
      table: "blocks",
      conflictKeys: ["id"],
      rows: blocks.map(serialize),
      transaction: knexTransaction,
    });
  });
};

export function fullBlocksToDbBlocks(blocks: Block[]): DatabaseBlock[] {
  return blocks.map(fullBlockToDbBlock);
};

export function fullBlockToDbBlock(block: Block): DatabaseBlock {
  return {
    id: block.indep_hash,
    height: block.height,
    previous_block: block.previous_block,
    txs: block.txs,
    mined_at: moment(block.timestamp * 1000).format(),
    extended: pick(block, extendedFields),
  };
};


export function serialize(row: DatabaseBlock): object {
  return transform(row, (result: any, value: any, key: string) => {
    result[key] = value && typeof value == "object" ? JSON.stringify(value) : value;
  });
};
