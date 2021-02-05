import ProgressBar from 'progress';
import {config} from 'dotenv';
import {log} from '../utility/log.utility';
import {block, currentBlock} from '../query/block.query';
import {storeBlock} from './batch.database';

config();

export const parallelization = parseInt(process.env.PARALLEL || '8');
export let bar: ProgressBar;
export let startHeight = 0;

export async function startSync() {
  log.info(`[database] starting sync, parallelization is set to ${parallelization}`);

  const initialBlock = await currentBlock();
  startHeight = initialBlock.height;
  bar = new ProgressBar(
      `:current/:total blocks synced [:bar] :percent :etas`,
      {
        complete: '|',
        incomplete: ' ',
        total: startHeight,
      },
  );

  await storeBlock(initialBlock);

  if (parallelization) {
    parallelize(startHeight - 1);
  }
}

export async function parallelize(height: number) {
  if (height > 1) {
    const batch = [];

    for (let i = height; i > 0 && i > height - 8; i--) {
      batch.push(traverseBlocks(i));
    }

    await Promise.all(batch);
    parallelize(height - 8);
  } else {
    log.info(`[database] sync complete`);
  }
}

export async function traverseBlocks(height: number) {
  const currentBlock = await block(height);
  await storeBlock(currentBlock);
  bar.tick(1);
}
