import knex from "knex";
import { ImportBlock } from "../interfaces/messages";
import { Block } from "../lib/arweave";
import {
  fullBlocksToDbBlocks,
  fullBlockToDbBlock,
  getLatestBlock,
  getRecentBlocks,
  insertBlocks,
} from "../lib/block-db";
import { createConnectionPool } from "../lib/postgres";
import { firstResponse } from "../lib/proxy";
import { createQueueHandler, getQueueUrl } from "../lib/queues";

let pool: knex;

export const handler = createQueueHandler<ImportBlock>(
  getQueueUrl("import-blocks"),
  async ({ block, source }) => {
    console.log(`message:`, block);
    console.log(`source:`, source);

    await pool.transaction(async (knexTransaction) => {
      try {
        const latestBlock = await getLatestBlock(knexTransaction);

        console.log(`Proposed block: ${block.indep_hash}`);

        // If these two values match up then everything is worked as expected.
        if (block.previous_block == latestBlock.id) {
          await insertBlocks(knexTransaction, [fullBlockToDbBlock(block)]);
          console.log(`Block accepted: ${block.indep_hash}`);
        } else {
          // If they don't match up, then we need to start fork recovering.
          // We'll fetch the previous blocks in this fork from arweave nodes
          // and try to splice them with the chain in our database.
          console.log(`Resolving fork: ${block.indep_hash}`);
          const forkDiff = await resolveFork(
            (await getRecentBlocks(knexTransaction)).map((block) => block.id),
            [block],
            {
              maxDepth: 200,
            }
          ).then(fullBlocksToDbBlocks);

          console.log(`Resolved fork: ${block.indep_hash}`, forkDiff);

          await insertBlocks(knexTransaction, forkDiff);
        }
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

/**
 * Try and find the branch point between the chain in our database and the chain
 * belonging to the new block we've just received. If we find a branch point,
 * We'll return the diff as a sorted array containing all the missing blocks.
 */
export const resolveFork = async (
  mainChainIds: string[],
  fork: Block[],
  {
    currentDepth = 0,
    maxDepth = 10,
  }: { currentDepth?: number; maxDepth: number }
): Promise<Block[]> => {
  // Grab the last known block from the forked chain (blocks are appended, newest -> oldest).
  const block = fork[fork.length - 1];

  console.log(`Resolving from height: ${block.height}, id ${block.indep_hash}`);

  // If this block has a previous_block value that intersects with the the main chain ids,
  // then it means we've resolved the fork. The fork array now contains the block
  // diff between the two chains, sorted by height descending.
  if (mainChainIds.includes(block.previous_block)) {
    console.log(
      `Chains intersect found at height: ${block.height}, id: ${block.previous_block}`
    );

    return fork;
  }

  if (currentDepth >= maxDepth) {
    throw new Error(`Couldn't resolve fork within maxDepth of ${maxDepth}`);
  }

  const { originResponse } = await firstResponse(
    `block/hash/${block.previous_block}`
  );

  const previousBlock = (await originResponse.json()) as Block;

  //For now we don't care about the poa and it's takes up too much
  // space when logged, so just remove it for now.
  //@ts-ignore
  delete previousBlock.poa;

  // If we didn't intersect the mainChainIds array then we're still working backwards
  // through the forked chain and haven't found the branch point yet.
  // We'll add this previous block block to the end of the fork and try again.
  return resolveFork(mainChainIds, [...fork, previousBlock], {
    currentDepth: currentDepth + 1,
    maxDepth,
  });
};
