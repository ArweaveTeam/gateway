import ProgressBar from 'progress';
import { DataItemJson } from 'arweave-bundles';
import { config } from 'dotenv';
import { getLastBlock } from '../utility/height.utility';
import {
  serializeBlock,
  serializeTransaction,
  serializeAnsTransaction,
  serializeTags,
} from '../utility/serialize.utility';
import {
  streams,
  initStreams,
  resetCacheStreams,
} from '../utility/csv.utility';
import { log } from '../utility/log.utility';
import { ansBundles } from '../utility/ans.utility';
import { mkdir } from '../utility/file.utility';
import { sleep } from '../utility/sleep.utility';
import { TestSuite } from '../utility/mocha.utility';
import { getNodeInfo } from '../query/node.query';
import { block } from '../query/block.query';
import { transaction, tagValue, Tag } from '../query/transaction.query';
import { getDataFromChunks } from '../query/node.query';
import {
  importBlocks,
  importTransactions,
  importTags,
} from './import.database';
import { DatabaseTag } from './transaction.database';
import { cacheANSEntries } from '../caching/ans.entry.caching';

config();
mkdir('snapshot');
mkdir('cache');

export const storeSnapshot = process.env.SNAPSHOT === '1' ? true : false;
export const parallelization = parseInt(process.env.PARALLEL || '8');

export let SIGINT: boolean = false;
export let SIGKILL: boolean = false;
export let bar: ProgressBar;
export let topHeight = 0;
export let currentHeight = 0;
export let timer = setTimeout(() => {}, 0);

export function configureSyncBar(start: number, end: number) {
  bar = new ProgressBar(':current/:total blocks synced [:bar] :percent :etas', {
    complete: '|',
    incomplete: ' ',
    total: end - start,
  });
}

export function startSync() {
  getLastBlock().then(async (startHeight) => {
    if (parallelization > 0) {
      log.info(
        `[database] starting sync, parallelization is set to ${parallelization}`
      );
      if (storeSnapshot) {
        log.info('[snapshot] also writing new blocks to the snapshot folder');
      }
      initStreams();
      signalHook();
      if (startHeight > 0) {
        const nodeInfo = await getNodeInfo();
        if (nodeInfo) {
          nodeInfo && configureSyncBar(startHeight, nodeInfo.height);
          topHeight = nodeInfo.height;

          log.info(
            `[database] database is currently at height ${startHeight}, resuming sync to ${topHeight}`
          );

          bar.tick();
          await parallelize(startHeight + 1);
        }
      } else {
        const nodeInfo = await getNodeInfo();
        if (nodeInfo) {
          configureSyncBar(0, nodeInfo.height);
          topHeight = nodeInfo.height;
          bar.tick();
          await parallelize(0);
        } else {
          console.error(
            'Failed to establish any connection to Nodes after 100 retries'
          );
          process.exit(1);
        }
      }
    }
  });
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
    if (nodeInfo && nodeInfo.height > topHeight) {
      log.info(
        `[database] updated height from ${topHeight} to ${nodeInfo.height} syncing new blocks`
      );
      topHeight = nodeInfo.height;
    }

    await parallelize(height);
  } else {
    const batch = [];

    for (let i = height; i < height + parallelization && i < topHeight; i++) {
      const blok = storeBlock(i);
      if (!blok) {
        // basically telling typescript to stfu
        log.error(
          `[database] shouldn't happen, but it seems a block creation went wrong`
        );
        process.exit(1);
      }
      batch.push(blok);
    }

    SIGINT = true;

    await Promise.all(batch).catch((error) => {
      throw new Error(error);
    });

    await importBlocks(`${process.cwd()}/cache/block.csv`);
    await importTransactions(`${process.cwd()}/cache/transaction.csv`);
    await importTags(`${process.cwd()}/cache/tags.csv`);

    resetCacheStreams();

    if (!bar.complete) {
      bar.tick(batch.length);
    }

    SIGINT = false;

    if (SIGKILL === false) {
      await parallelize(height + batch.length);
    }
  }
}

export function storeBlock(height: number, retry: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    block(height)
      .then((currentBlock) => {
        if (currentBlock) {
          const { formattedBlock, input } = serializeBlock(
            currentBlock,
            height
          );

          streams.block.cache.write(input);

          if (storeSnapshot) {
            streams.block.snapshot.write(input);
          }

          if (height > 0) {
            storeTransactions(
              JSON.parse(formattedBlock.txs) as Array<string>,
              height
            ).then(resolve);
          } else {
            resolve();
          }
        } else {
          return new Promise((res) => setTimeout(res, 10)).then(() => {
            if (retry >= 25) {
              log.info(
                `[snapshot] could not retrieve block at height ${height}`
              );
              return reject('Failed to fetch block after 25 retries');
            } else {
              return resolve(storeBlock(height, retry + 1));
            }
          });
        }
      })
      .catch((error) => {
        log.error(`[snapshot] error ${error}`);
        if (SIGKILL === false) {
          if (retry >= 25) {
            log.info(`[snapshot] there were problems retrieving ${height}`);
            return reject(error);
          } else {
            return resolve(storeBlock(height, retry + 1));
          }
        }
      });
  });
}

export async function storeTransactions(txs: Array<string>, height: number) {
  const batch = [];

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    batch.push(storeTransaction(tx, height));
  }

  await Promise.all(batch);
}

export async function storeTransaction(
  tx: string,
  height: number,
  retry: boolean = true
) {
  try {
    const currentTransaction = await transaction(tx);
    const { formattedTransaction, preservedTags, input } = serializeTransaction(
      currentTransaction,
      height
    );

    streams.transaction.cache.write(input);

    if (storeSnapshot) {
      streams.transaction.snapshot.write(input);
    }

    storeTags(formattedTransaction.id, preservedTags);

    const ans102 = tagValue(preservedTags, 'Bundle-Type') === 'ANS-102';

    if (ans102) {
      await processAns(formattedTransaction.id, height);
    }
  } catch (error) {
    console.log('');
    log.info(
      `[database] could not retrieve tx ${tx} at height ${height} ${
        retry
          ? ', attempting to retrieve again'
          : ', missing tx stored in .rescan'
      }`
    );
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

export async function processAns(
  id: string,
  height: number,
  retry: boolean = true
) {
  try {
    const ansPayload = await getDataFromChunks(id);
    const ansTxs = await ansBundles.unbundleData(ansPayload.toString('utf-8'));

    await cacheANSEntries(ansTxs);
    await processANSTransaction(ansTxs, height);
  } catch (error) {
    if (retry) {
      await processAns(id, height, false);
    } else {
      log.info(
        `[database] malformed ANS payload at height ${height} for tx ${id}`
      );
      streams.rescan.cache.write(`${id}|${height}|ans\n`);
      if (storeSnapshot) {
        streams.rescan.snapshot.write(`${id}|${height}|ans\n`);
      }
    }
  }
}

export async function processANSTransaction(
  ansTxs: Array<DataItemJson>,
  height: number
) {
  for (let i = 0; i < ansTxs.length; i++) {
    const ansTx = ansTxs[i];
    const { ansTags, input } = serializeAnsTransaction(ansTx, height);

    streams.transaction.cache.write(input);

    if (storeSnapshot) {
      streams.transaction.snapshot.write(input);
    }

    for (let ii = 0; ii < ansTags.length; ii++) {
      const ansTag = ansTags[ii];
      const { name, value } = ansTag;

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
    const tag = tags[i];
    const { input } = serializeTags(tx_id, i, tag);
    streams.tags.cache.write(input);
    if (storeSnapshot) {
      streams.tags.snapshot.write(input);
    }
  }
}

export function signalHook() {
  if (!TestSuite) {
    process.on('SIGINT', () => {
      log.info(
        '[database] ensuring all blocks are stored before exit, you may see some extra output in console'
      );
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
