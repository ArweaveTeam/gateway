import ProgressBar from 'progress';
import Fluture from 'fluture';
import * as F from 'fluture';
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
F.debugMode(true);

export const storeSnapshot = process.env.SNAPSHOT === '1' ? true : false;

export let SIGINT: boolean = false;
export let SIGKILL: boolean = false;
export let bar: ProgressBar;
export let topHeight = 0;
export let currentHeight = 0;
export let timer = setTimeout(() => {}, 0);

export function configureSyncBar(start: number, end: number) {
  bar = new ProgressBar(':current/:total blocks synced :percent', {
    curr: start,
    total: end,
  });
  bar.curr = start;
}

export function startSync() {
  getLastBlock().then((startHeight) => {
    log.info(`[database] starting sync`);

    if (storeSnapshot) {
      log.info('[snapshot] also writing new blocks to the snapshot folder');
    }
    initStreams();
    signalHook();

    getNodeInfo().then((nodeInfo) => {
      if (nodeInfo) {
        configureSyncBar(startHeight, nodeInfo.height);
        topHeight = nodeInfo.height;
        bar.tick();
        // await parallelize(0);

        F.fork((reason: string | void) => {
          console.error('Fatal', reason || '');
          process.exit(1);
        })(() => console.log('DONE!'))(
          F.parallel(
            (isNaN as any)(process.env['PARALLEL'])
              ? 36
              : parseInt(process.env['PARALLEL'] || '36')
          )(
            Array.from(
              Array(Math.abs(nodeInfo.height) - Math.abs(startHeight)).keys()
            ).map((h) => {
              return storeBlock(h + startHeight, bar);
            })
          )
        );
      } else {
        console.error(
          'Failed to establish any connection to Nodes after 100 retries'
        );
        process.exit(1);
      }
    });
  });
}

export function storeBlock(height: number, bar: ProgressBar): Promise<void> {
  return Fluture(
    (reject: (reason: string | void) => void, resolve: () => void) => {
      let isCancelled = false;
      function getBlock(retry = 0) {
        !isCancelled &&
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

                storeTransactions(
                  JSON.parse(formattedBlock.txs) as Array<string>,
                  height
                );
                bar.tick();
                resolve();
              } else {
                new Promise((res) => setTimeout(res, 100)).then(() => {
                  if (retry >= 250) {
                    log.info(
                      `[snapshot] could not retrieve block at height ${height}`
                    );
                    reject('Failed to fetch block after 250 retries');
                  } else {
                    return getBlock(retry + 1);
                  }
                });
              }
            })
            .catch((error) => {
              log.error(`[snapshot] error ${error}`);
              if (SIGKILL === false) {
                if (retry >= 250) {
                  log.info(
                    `[snapshot] there were problems retrieving ${height}`
                  );
                  reject(error);
                } else {
                  return getBlock(retry + 1);
                }
              }
            });
      }
      getBlock();
      return () => {
        isCancelled = true;
      };
    }
  );
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
  const currentTransaction = await transaction(tx);
  if (currentTransaction) {
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
  } else {
    console.error('Fatal network error');
    process.exit(1);
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
          console.log('');
          process.exit();
        }
      }, 100);
    });
  }
}
