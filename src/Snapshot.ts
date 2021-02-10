import ProgressBar from 'progress';
import { config } from 'dotenv';
import { existsSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
import { log } from './utility/log.utility';
import { getNodeInfo } from './query/node.query';
import { block } from './query/block.query';
import { transaction } from './query/transaction.query';
import { formatBlock } from './database/block.database';
import { transactionFields, DatabaseTag, formatTransaction, formatAnsTransaction } from './database/transaction.database';

config();

export let snapshotBar: ProgressBar;

export const streams = {
    block: createWriteStream('snapshot/block.csv.gz', { flags: 'a' }),
    transaction: createWriteStream('snapshot/transaction.csv.gz', { flags: 'a' }),
    tags: createWriteStream('snapshot/tags.csv.gz', { flags: 'a' }),
}

export const indices = JSON.parse(process.env.INDICES || '[]') as Array<string>;

export function configureSnapshotBar(start: number, end: number) {
    snapshotBar = new ProgressBar(
        ':current/:total blocks synced [:bar] :percent :etas',
        {
          complete: '|',
          incomplete: ' ',
          total: end - start,
        },
    );
}

export async function snapshot() {
    if (existsSync('.snapshot')) {
        log.info('[snapshot] existing snapshot state found');
        const snapshotState = parseInt(readFileSync('.snapshot').toString());

        if (!isNaN(snapshotState)) {
            log.info(`[snapshot] snapshot state is at height ${snapshotState}, resuming sync`);
            const nodeInfo = await getNodeInfo();
            configureSnapshotBar(snapshotState, nodeInfo.height);
            await storeBlock(snapshotState + 1);
        } else {
            log.info(`[snapshot] snapshot state is malformed. Please make sure it is a number`);
            process.exit();
        }
    } else {
        log.info(`[snapshot] new snapshot is being generated`);
        const nodeInfo = await getNodeInfo();
        configureSnapshotBar(0, nodeInfo.height);
        await storeBlock(0);
    }
}

export async function storeBlock(height: number) {
    try {
        const currentBlock = await block(height);
        const fb = formatBlock(currentBlock);
    
        streams.block.write(`${fb.id},${fb.previous_block},${fb.mined_at},${fb.height},${fb.txs},${fb.extended}\n`);
    
        if (height > 0) {
            await storeTransactions(JSON.parse(fb.txs) as Array<string>, height);
        }
    
        snapshotBar.tick();
        writeFileSync('.snapshot', height.toString());
    
        await storeBlock(height + 1);
    } catch (error) {
        log.info(`[snapshot] could not retrieve block at height ${height}, retrying`);
        await storeBlock(height);
    }
}

export async function storeTransactions(txs: Array<string>, height: number) {
    const batch = [];

    for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        batch.push(storeTransaction(tx, height));
    }

    await Promise.all(batch);
}

export async function storeTransaction(tx: string, height: number) {
    try {
        const currentTransaction = await transaction(tx);
        const ft = formatTransaction(currentTransaction);
        const fields = transactionFields.map(field => ft[field]).concat(indices.map(ifield => ft[ifield]))
        streams.transaction.write(`${fields.join(',')}\n`);

        storeTags(JSON.parse(ft.tags) as Array<DatabaseTag>);
    } catch (error) {
        log.info(`[snapshot] could not retrieve tx ${tx} at height ${height}`);
    }
}

export function storeTags(tags: Array<DatabaseTag>) {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        streams.tags.write(`${tag.tx_id},${tag.index},${tag.name},${tag.value}\n`);
    }
}

(async () => await snapshot())();