import retry from "async-retry";
import {
  fullBlocksToDbBlocks,
  fullBlockToDbBlock,
  getLatestBlock,
  getRecentBlocks,
  saveBlocks,
} from "../database/block-db";
import {
  getConnectionPool,
  releaseConnectionPool,
  initConnectionPool,
} from "../database/postgres";
import { ImportBlock, ImportTx } from "../interfaces/messages";
import { Block, fetchBlock } from "../lib/arweave";
import { sequentialBatch, wait } from "../lib/helpers";
import { createQueueHandler, enqueueBatch, getQueueUrl } from "../lib/queues";
import log from "../lib/log";

export const handler = createQueueHandler<ImportBlock>(
  getQueueUrl("import-blocks"),
  async ({ block, source }) => {
    log.info(`[import-txs] importing block`, { id: block.indep_hash, source });

    const txImportQueueUrl = await getQueueUrl("import-txs");
    const pool = getConnectionPool("write");

    await pool.transaction(async (knexTransaction) => {
      try {
        const latestBlock = await getLatestBlock(knexTransaction);

        // If these two values match up then everything is worked as expected.
        if (block.previous_block == latestBlock.id) {
          log.info(`[import-blocks] block accepted`, { id: block.indep_hash });
          await saveBlocks(knexTransaction, [fullBlockToDbBlock(block)]);

          await enqueueTxImports(txImportQueueUrl, block.txs);
        } else {
          // If they don't match up, then we need to start fork recovering.
          // We'll fetch the previous blocks in this fork from arweave nodes
          // and try to splice them with the chain in our database.
          log.info(`[import-blocks] fork detected`, {
            id: block.indep_hash,
            height: block.height,
          });

          const forkDiff = await resolveFork(
            (await getRecentBlocks(knexTransaction)).map((block) => block.id),
            [block],
            {
              maxDepth: 3000,
            }
          ).then(fullBlocksToDbBlocks);

          log.info(`[import-blocks] resolved fork`, {
            length: forkDiff.length,
          });

          await saveBlocks(knexTransaction, forkDiff);

          const txIds = forkDiff.reduce(
            (ids: string[], block) => ids.concat(block.txs),
            []
          );

          // requeue *all* transactions involved in blocks that have forked.
          // Some of them may have been imported already and purged, so we
          // reimport everything to make sure there are no gaps.
          await enqueueTxImports(txImportQueueUrl, txIds);
        }
      } catch (error) {
        console.error(block.indep_hash, error);
        console.log(await knexTransaction.rollback(error));
      }
    });
  },
  {
    before: async () => {
      log.info(`[import-blocks] handler:before database connection init`);
      initConnectionPool("write");
      await wait(1000);
    },
    after: async () => {
      log.info(`[import-blocks] handler:after database connection cleanup`);
      await releaseConnectionPool("write");
      await wait(1000);
    },
  }
);

const enqueueTxImports = async (queueUrl: string, txIds: string[]) => {
  await sequentialBatch(txIds, 10, async (ids: string[]) => {
    log.info(`[import-blocks] queuing block txs`, {
      ids,
    });
    await enqueueBatch<ImportTx>(
      queueUrl,
      ids.map((id) => {
        return {
          id: id,
          message: {
            id,
          },
        };
      })
    );
  });
};

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

  log.info(`[import-blocks] resolving fork`, {
    id: block.indep_hash,
    height: block.height,
  });

  // If this block has a previous_block value that intersects with the the main chain ids,
  // then it means we've resolved the fork. The fork array now contains the block
  // diff between the two chains, sorted by height descending.
  if (mainChainIds.includes(block.previous_block)) {
    log.info(`[import-blocks] resolved fork`, {
      id: block.indep_hash,
      height: block.height,
    });

    return fork;
  }

  if (currentDepth >= maxDepth) {
    throw new Error(`Couldn't resolve fork within maxDepth of ${maxDepth}`);
  }

  const previousBlock = await retry(
    async () => {
      return fetchBlock(block.previous_block);
    },
    {
      retries: 5,
    }
  );

  // If we didn't intersect the mainChainIds array then we're still working backwards
  // through the forked chain and haven't found the branch point yet.
  // We'll add this previous block block to the end of the fork and try again.
  return resolveFork(mainChainIds, [...fork, previousBlock], {
    currentDepth: currentDepth + 1,
    maxDepth,
  });
};
