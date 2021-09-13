import ProgressBar from 'progress';
import {DataItemJson} from 'arweave-bundles';
import {config} from 'dotenv';
import {getLastBlock} from '../utility/height.utility';
import {serializeBlock, serializeTransaction, serializeAnsTransaction} from '../utility/serialize.utility';
import {streams, initStreams} from '../utility/csv.utility';
import {log} from '../utility/log.utility';
import {ansBundles} from '../utility/ans.utility';
import {sleep} from '../utility/sleep.utility';
import {TestSuite} from '../utility/mocha.utility';
import {getNodeInfo} from '../query/node.query';
import {block} from '../query/block.query';
import {transaction, tagValue, Tag} from '../query/transaction.query';
import {getDataFromChunks} from '../query/node.query';
import {importBlock, importTransaction, importTag} from './import.database';
import {DatabaseTag} from './transaction.database';
import {cacheANSEntries} from '../caching/ans.entry.caching';
import {syncAppNode} from './sync.app.database';

config();

export const nodeType = process.env.TYPE ?? 'APP';
export const storeANS102 = process.env.ANS102 === '1' ? true : false;
export const storeSnapshot = process.env.SNAPSHOT === '1' ? true : false;
export const parallelization = parseInt(process.env.PARALLEL || '1');

export let SIGINT: boolean = false;
export let SIGKILL: boolean = false;
export let bar: ProgressBar;
export let topHeight = 0;
export let currentHeight = 0;
export let timer = setTimeout(() => {}, 0);

export function configureSyncBar(start: number, end: number) {
  bar = new ProgressBar(
      ':current/:total blocks synced [:bar] :percent :etas',
      {
        complete: '|',
        incomplete: ' ',
        total: end - start,
      },
  );
}

export async function startSync() {
  if (nodeType === 'APP') {
    await syncAppNode();
    return;
  }

  const startHeight = await getLastBlock();
  currentHeight = startHeight;

  if (parallelization > 0) {
    log.info(`[database] starting sync, parallelization is set to ${parallelization}`);
    if (storeSnapshot) {
      log.info('[snapshot] also writing new blocks to the snapshot folder');
    }

    initStreams();
    signalHook();

    if (startHeight > 0) {
      const nodeInfo = await getNodeInfo();
      configureSyncBar(startHeight, nodeInfo.height);
      topHeight = nodeInfo.height;

      log.info(`[database] database is currently at height ${startHeight}, resuming sync to ${topHeight}`);

      bar.tick();
      await parallelize(startHeight + 1);
    } else {
      const nodeInfo = await getNodeInfo();
      configureSyncBar(0, nodeInfo.height);
      topHeight = nodeInfo.height;
      log.info(`[database] syncing from block 0 to ${topHeight}`);
      bar.tick();
      await parallelize(0);
    }
  }
}

export async function parallelize(height: number) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    log.info('[database] sync timed out, restarting server');
    process.exit();
  }, 300 * 1000);

  currentHeight = height;

  if (height >= topHeight) {
    log.info('[database] fully synced, monitoring for new blocks');
    await sleep(30000);
    const nodeInfo = await getNodeInfo();
    if (nodeInfo.height > topHeight) {
      log.info(`[database] updated height from ${topHeight} to ${nodeInfo.height} syncing new blocks`);
      topHeight = nodeInfo.height;
    }

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

export async function storeBlock(height: number, retry: number = 0) {
  try {
    const currentBlock = await block(height);
    const {formattedBlock} = serializeBlock(currentBlock, height);

    importBlock(currentBlock);

    if (height > 0) {
      await storeTransactions(JSON.parse(formattedBlock.txs) as Array<string>, height);
    }
  } catch (error) {
    if (SIGKILL === false) {
      if (retry >= 25) {
        log.info(`[snapshot] there were problems retrieving ${height}, restarting the server`);
        await startSync();
      } else {
        log.info(`[snapshot] could not retrieve block at height ${height}, retrying`);
        await storeBlock(height, retry + 1);
      }
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
    const {formattedTransaction, preservedTags} = serializeTransaction(currentTransaction, height);

    importTransaction(currentTransaction);

    storeTags(formattedTransaction.id, preservedTags);

    if (storeANS102) {
      const ans102 = tagValue(preservedTags, 'Bundle-Type') === 'ANS-102';

      if (ans102) {
        await processAns(formattedTransaction.id, height);
      }
    }
  } catch (error) {
    console.log('');
    log.info(`[database] could not retrieve tx ${tx} at height ${height} ${retry ? ', attempting to retrieve again' : ', missing tx stored in .rescan'}`);
    if (retry) {
      await storeTransaction(tx, height, false);
    } else {
      streams.rescan.cache.write(`${tx}|${height}|normal\n`);
      if (storeSnapshot) {
        streams.rescan.snapshot.write(`${tx}|${height}|normal\n`);
      }
    }
  }
}

export async function processAns(id: string, height: number, retry: boolean = true) {
  try {
    const ansPayload = await getDataFromChunks(id);
    const ansTxs = await ansBundles.unbundleData(ansPayload.toString('utf-8'));

    await cacheANSEntries(ansTxs);
    await processANSTransaction(ansTxs, height);
  } catch (error) {
    if (retry) {
      await processAns(id, height, false);
    } else {
      log.info(`[database] malformed ANS payload at height ${height} for tx ${id}`);
      streams.rescan.cache.write(`${id}|${height}|ans\n`);
      if (storeSnapshot) {
        streams.rescan.snapshot.write(`${id}|${height}|ans\n`);
      }
    }
  }
}

export async function processANSTransaction(ansTxs: Array<DataItemJson>, height: number) {
  for (let i = 0; i < ansTxs.length; i++) {
    const ansTx = ansTxs[i];
    const {ansTags, input} = serializeAnsTransaction(ansTx, height);

    streams.transaction.cache.write(input);

    if (storeSnapshot) {
      streams.transaction.snapshot.write(input);
    }

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

      streams.tags.cache.write(input);

      if (storeSnapshot) {
        streams.tags.snapshot.write(input);
      }
    }
  }
}

export function storeTags(tx_id: string, tags: Array<Tag>) {
  for (let i = 0; i < tags.length; i++) {
    const tag: DatabaseTag = {
      tx_id,
      index: i,
      name: tags[i].name || '',
      value: tags[i].value || '',
    };

    importTag(tag);
  }
}


export function signalHook() {
  if (!TestSuite) {
    process.on('SIGINT', () => {
      log.info('[database] ensuring all blocks are stored before exit, you may see some extra output in console');
      SIGKILL = true;
      setInterval(() => {
        if (SIGINT === false) {
          log.info('[database] block sync state preserved, now exiting');
          process.exit();
        }
      }, 100);
    });
  }
}
