import ProgressBar from 'progress';
import {existsSync, readFileSync, writeFileSync} from 'fs';
import {config} from 'dotenv';
import {log} from '../utility/log.utility';
import {block, currentBlock} from '../query/block.query';
import {storeBlock} from './batch.database';

config();

export const syncPath = process.env.SYNC_PATH || '.sync.state.json';

export interface SyncState {
  head: number;
  base: number;
}

export let syncState: SyncState = {
  head: 0,
  base: 0,
}

export let SIGINT: boolean = false;
export let SIGKILL: boolean = false;

export const parallelization = parseInt(process.env.PARALLEL || '8');
export let bar: ProgressBar;
export let startHeight = 0;

export async function startSync() {
  log.info(`[database] starting sync, parallelization is set to ${parallelization}`);  

  const initialBlock = await currentBlock();
  startHeight = initialBlock.height;

  if (existsSync(syncPath)) {
    syncState = JSON.parse(readFileSync('.sync.state.json').toString());
    log.info(`[database] existing sync state found, starting sync from block ${syncState.base}`);
  } else {
    await storeBlock(initialBlock);

    syncState.head = startHeight;
    syncState.base = startHeight - 1;
  }

  bar = new ProgressBar(
      `:current/:total blocks synced [:bar] :percent :etas`,
      {
        complete: '|',
        incomplete: ' ',
        total: syncState.base,
      },
  );

  if (parallelization) {
    parallelize(syncState.base);
  }

  process.on('SIGINT', () => {
    log.info(`[database] ensuring all blocks are stored before exit, you may see some extra output in console`);
    SIGKILL = true;
    setInterval(() => {
      if (SIGINT === false) {
        log.info(`[database] block sync state preserved, now exiting`);
        process.exit();
      }
    }, 100);
  });
}

export async function parallelize(height: number) {
  if (height > 1) {
    const batch = [];

    for (let i = height; i > 0 && i > height - 8; i--) {
      batch.push(traverseBlock(i));
    }

    SIGINT = true;
    await Promise.all(batch);
    
    syncState.base -= 8;
    writeFileSync(syncPath, JSON.stringify(syncState, null, 2));

    SIGINT = false;

    if (SIGKILL === false) {
      parallelize(height - 8);
    }
  } else {
    log.info(`[database] sync complete`);
  }
}

export async function traverseBlock(height: number) {
  const currentBlock = await block(height);
  await storeBlock(currentBlock);
  bar.tick(1);
}
