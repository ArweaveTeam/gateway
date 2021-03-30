import ProgressBar from 'progress';
import {DataItemJson} from 'arweave-bundles';
import {config} from 'dotenv';
import {lastBlock} from './utility/height.utility';
import {serializeBlock, serializeTransaction, serializeAnsTransaction, serializeTags} from './utility/serialize.utility';
import {streams, initStreams} from './utility/csv.utility';
import {ansBundles} from './utility/ans.utility';
import {mkdir} from './utility/file.utility';
import {log} from './utility/log.utility';
import {sleep} from './utility/sleep.utility';
import {TestSuite} from './utility/mocha.utility';
import {getNodeInfo, getDataFromChunks} from './query/node.query';
import {block} from './query/block.query';
import {transaction, tagValue, Tag} from './query/transaction.query';
import {DatabaseTag} from './database/transaction.database';

config();
mkdir('snapshot');

export const parallelization = parseInt(process.env.PARALLEL || '8');

export let SIGINT: boolean = false;
export let SIGKILL: boolean = false;

export let bar: ProgressBar;
export let topHeight = 0;

export function configureSnapshotBar(start: number, end: number) {
  bar = new ProgressBar(
      ':current/:total blocks synced [:bar] :percent :etas',
      {
        complete: '|',
        incomplete: ' ',
        total: end - start,
      },
  );
}

export async function snapshot() {
  const startHeight = await lastBlock();

  initStreams();
  signalHook();

  if (startHeight > 0) {
    const nodeInfo = await getNodeInfo();
    configureSnapshotBar(startHeight, nodeInfo.height);
    topHeight = nodeInfo.height;
    log.info(`[snapshot] snapshot is currently at height ${startHeight}, resuming sync to ${topHeight}`);
    bar.tick();
    await parallelize(startHeight + 1);
  } else {
    const nodeInfo = await getNodeInfo();
    configureSnapshotBar(0, nodeInfo.height);
    topHeight = nodeInfo.height;
    log.info(`[snapshot] new snapshot is being generated, syncing from block 0 to ${topHeight}`);
    bar.tick();
    await parallelize(0);
  }
}

export async function parallelize(height: number) {
  if (height >= topHeight) {
    log.info('[snapshot] fully synced, monitoring for new blocks');
    await sleep(30000);
    const nodeInfo = await getNodeInfo();
    if (nodeInfo.height > topHeight) {
      log.info(`[snapshot] updated height from ${topHeight} to ${nodeInfo.height} syncing new blocks`);
    }
    topHeight = nodeInfo.height;
    await parallelize(height);
  } else {
    const batch = [];

    for (let i = height; i < height + parallelization && i < topHeight; i++) {
      batch.push(storeBlock(i));
    }

    SIGINT = true;

    await Promise.all(batch);

    if (!bar.complete) {
      bar.tick(batch.length);
    }

    SIGINT = false;

    if (SIGKILL === false) {
      await parallelize(height + batch.length);
    }
  }
}

export async function storeBlock(height: number) {
  try {
    const currentBlock = await block(height);
    const {formattedBlock, input} = serializeBlock(currentBlock, height);

    streams.block.snapshot.write(input);

    if (height > 0) {
      await storeTransactions(JSON.parse(formattedBlock.txs) as Array<string>, height);
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

export async function storeTransaction(tx: string, height: number, retry: boolean = true) {
  try {
    const currentTransaction = await transaction(tx);
    const {formattedTransaction, preservedTags, input} = serializeTransaction(currentTransaction, height);

    streams.transaction.snapshot.write(input);
    storeTags(formattedTransaction.id, preservedTags);

    const ans102 = tagValue(preservedTags, 'Bundle-Type') === 'ANS-102';

    if (ans102) {
      await processAns(formattedTransaction.id, height);
    }
  } catch (error) {
    console.log('');
    log.info(`[snapshot] could not retrieve tx ${tx} at height ${height} ${retry ? ', attempting to retrieve again' : ', missing tx stored in .rescan'}`);
    if (retry) {
      await storeTransaction(tx, height, false);
    } else {
      streams.rescan.snapshot.write(`${tx},${height},normal\n`);
    }
  }
}

export async function processAns(id: string, height: number, retry: boolean = true) {
  try {
    const ansPayload = await getDataFromChunks(id);
    const ansTxs = await ansBundles.unbundleData(ansPayload);

    await processANSTransaction(ansTxs, height);
  } catch (error) {
    if (retry) {
      await processAns(id, height, false);
    } else {
      log.info(`[database] malformed ANS payload at height ${height} for tx ${id}`);
      streams.rescan.snapshot.write(`${id},${height},ans\n`);
    }
  }
}

export async function processANSTransaction(ansTxs: Array<DataItemJson>, height: number) {
  for (let i = 0; i < ansTxs.length; i++) {
    const ansTx = ansTxs[i];
    const {ansTags, input} = serializeAnsTransaction(ansTx, height);

    streams.transaction.snapshot.write(input);

    for (let ii = 0; ii < ansTags.length; ii++) {
      const ansTag = ansTags[ii];
      const {name, value} = ansTag;

      const tag: DatabaseTag = {
        tx_id: ansTx.id,
        index: ii,
        name: name || '',
        value: value || '',
      };

      const input = `"${tag.tx_id}"|"${tag.index}"|"${tag.name}"|"${tag.value}"\n`;

      streams.tags.snapshot.write(input);
    }
  }
}

export function storeTags(tx_id: string, tags: Array<Tag>) {
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const {input} = serializeTags(tx_id, i, tag);
    streams.tags.snapshot.write(input);
  }
}

(async () => await snapshot())();

export function signalHook() {
  if (!TestSuite) {
    process.on('SIGINT', () => {
      SIGKILL = true;
      setInterval(() => {
        if (SIGINT === false) {
          streams.block.snapshot.end();
          streams.transaction.snapshot.end();
          streams.tags.snapshot.end();
          process.exit();
        }
      }, 100);
    });
  }
}
