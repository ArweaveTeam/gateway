import knex from "knex";
import { Block } from "../lib/arweave";
import { upsert, DBConnection } from "./postgres";
import moment from "moment";
import { pick, transform } from "lodash";
import { sequentialBatch } from "../lib/helpers";
import log from "../lib/log";

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

export const saveBlocks = async (
  connection: DBConnection,
  blocks: DatabaseBlock[]
) => {
  return connection.transaction(async (knexTransaction) => {
    log.info(`[block-db] saving blocks`, {
      blocks: blocks.map((block) => {
        return { height: block.height, id: block.id };
      }),
    });

    const queries = [
      upsert(knexTransaction, {
        table: "blocks",
        conflictKeys: ["height"],
        rows: blocks.map(serialize),
        transaction: knexTransaction,
      }),
    ];

    const blockTxMappings: TxBlockHeight[] = blocks.reduce((map, block) => {
      return map.concat(
        block.txs.map((tx_id: string) => {
          return { height: block.height, id: tx_id };
        })
      );
    }, [] as TxBlockHeight[]);

    await sequentialBatch(
      blockTxMappings,
      5000,
      async (batch: TxBlockHeight[]) => {
        log.info(`[block-db] setting tx block heights`, {
          txs: batch.map((item) => {
            return { id: item.id, height: item.height };
          }),
        });
        queries.push(
          upsert(knexTransaction, {
            table: "transactions",
            conflictKeys: ["id"],
            rows: batch,
            transaction: knexTransaction,
          })
        );
      }
    );

    await Promise.all(queries);
  });
};

interface TxBlockHeight {
  id: string;
  height: number;
}

export const fullBlocksToDbBlocks = (blocks: Block[]): DatabaseBlock[] => {
  return blocks.map(fullBlockToDbBlock);
};
/**
 * Format a full block into a stripped down version for storage in the postgres DB.
 */
export const fullBlockToDbBlock = (block: Block): DatabaseBlock => {
  return {
    id: block.indep_hash,
    height: block.height,
    previous_block: block.previous_block,
    txs: block.txs,
    mined_at: moment(block.timestamp * 1000).format(),
    extended: pick(block, extendedFields),
  };
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
