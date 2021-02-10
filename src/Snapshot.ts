import ProgressBar from 'progress';
import {config} from 'dotenv';
import {existsSync, readFileSync, writeFileSync, createWriteStream} from 'fs';
import {mkdir} from './utility/file.utility';
import {log} from './utility/log.utility';
import {getNodeInfo} from './query/node.query';
import {block} from './query/block.query';
import {transaction} from './query/transaction.query';
import {formatBlock} from './database/block.database';
import {transactionFields, DatabaseTag, formatTransaction, formatAnsTransaction} from './database/transaction.database';

config();

export let SIGINT: boolean = false;
export let SIGKILL: boolean = false;

export let snapshotBar: ProgressBar;
export let topHeight = 0;

export const indices = JSON.parse(process.env.INDICES || '[]') as Array<string>;

mkdir('snapshot');

export const streams = {
  block: createWriteStream('snapshot/block.csv', {flags: 'a'}),
  transaction: createWriteStream('snapshot/transaction.csv', {flags: 'a'}),
  tags: createWriteStream('snapshot/tags.csv', {flags: 'a'}),
};

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
      const nodeInfo = await getNodeInfo();
      configureSnapshotBar(snapshotState, nodeInfo.height);
      topHeight = nodeInfo.height;
      log.info(`[snapshot] snapshot is currently at height ${snapshotState}, resuming sync to ${topHeight}`);
      await storeBlock(snapshotState + 1);
    } else {
      log.info('[snapshot] snapshot state is malformed. Please make sure it is a number');
      process.exit();
    }
  } else {
    const nodeInfo = await getNodeInfo();
    configureSnapshotBar(0, nodeInfo.height);
    topHeight = nodeInfo.height;
    log.info(`[snapshot] new snapshot is being generated, syncing from block 0 to ${topHeight}`);
    await storeBlock(0);
  }
}

export async function storeBlock(height: number) {
  try {
    const currentBlock = await block(height);
    const fb = formatBlock(currentBlock);

    streams.block.write(`"${fb.id}","${fb.previous_block}","${fb.mined_at}","${fb.height}","${fb.txs.replace(/"/g, '\\"')}","${fb.extended.replace(/"/g, '\\"')}"\n`);

    if (height > 0) {
      await storeTransactions(JSON.parse(fb.txs) as Array<string>, height);
    }

    SIGINT = true;

    snapshotBar.tick();
    writeFileSync('.snapshot', height.toString());

    if (height === topHeight) {
      log.info('[snapshot] synced to the specified height. Rerun yarn dev:snapshot to sync to the latest height');
      process.exit();
    }

    SIGINT = false;

    if (SIGKILL === false) {
      await storeBlock(height + 1);
    }
  } catch (error) {
    log.info(`[snapshot] could not retrieve block at height ${height}, retrying`);
    if (SIGKILL === false) {
      await storeBlock(height);
    }
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
    ft.tags = `${ft.tags.replace(/"/g, '\\"')}`;

    const fields = transactionFields
        .map((field) => `"${ft[field] ? ft[field] : ''}"`)
        .concat(indices.map((ifield) => `"${ft[ifield] ? ft[ifield] : ''}"`));

    streams.transaction.write(`${fields.join(',')}\n`);

    storeTags(JSON.parse(ft.tags) as Array<DatabaseTag>);
  } catch (error) {
    log.info(`[snapshot] could not retrieve tx ${tx} at height ${height}`);
  }
}

export function storeTags(tags: Array<DatabaseTag>) {
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    streams.tags.write(`"${tag.tx_id}","${tag.index}","${tag.name}","${tag.value}"\n`);
  }
}

(async () => await snapshot())();

process.on('SIGINT', () => {
  SIGKILL = true;
  setInterval(() => {
    if (SIGINT === false) {
      streams.block.end();
      streams.transaction.end();
      streams.tags.end();
      process.exit();
    }
  }, 100);
});
