import progress from 'progress';
import { log } from '../utility/log.utility';
import { block, currentBlock } from '../query/block.query';
import { storeBlock } from './batch.database';

export let bar: progress;
export let startHeight = 0;

export async function startSync() {
    log.info(`[database] starting sync`);
    
    const initialBlock = await currentBlock();
    startHeight = initialBlock.height;
    bar = new progress(
        `[database] :current/:total blocks synced [:bar] :percent :etas`,
        {
            complete: '|',
            incomplete: ' ',
            total: startHeight,
        },
    );

    await storeBlock(initialBlock);
    traverseBlocks(startHeight - 1);
}

export async function traverseBlocks(height: number) {
    const currentBlock = await block(height);
    await storeBlock(currentBlock);
    bar.tick(1);

    if (height > 1) {
        traverseBlocks(height - 1);
    } else {
        log.info(`[database] sync complete`);
    }
    
}