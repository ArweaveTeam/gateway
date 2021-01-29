import Knex from 'knex'

import log from '../lib/log'
import { TransactionHeader, fetchTransactionData, DataBundleWrapper, getTagValue, DataBundleItem, fetchTransactionHeader } from '../lib/arweave'
import { saveBundleStatus, getBundleImport, saveBundleDataItem } from '../database/bundle.database'
import { createQueueHandler, getQueueChannel, enqueue } from '../lib/queues'
import { ImportBundle } from '../interfaces/messages'
import { getConnectionPool, initConnectionPool, releaseConnectionPool } from '../database/postgres'
import { streamToJson, fromB64Url } from '../lib/encoding'
import { sequentialBatch } from '../lib/helpers'

import { put } from '../lib/buckets'

const MAX_RETRY = 10
const RETRY_BACKOFF_SECONDS = 30

export const handler = createQueueHandler<ImportBundle>(
    getQueueChannel('import-bundles'),
    async ({ header, id }) => {
      log.info({ header, id })
      log.info('[import-bundles] importing tx bundle', {
        bundle: {
          id,
          tx: header?.id,
        },
      })

      const pool = getConnectionPool('write')

      const tx = header || await fetchTransactionHeader(id || '')

      const { attempts = 0 } = await getBundleImport(pool, tx.id)

      log.info('[import-bundles] importing tx bundle status', {
        bundle: {
          id: tx.id,
          attempts,
        },
      })

      const incrementedAttempts = attempts + 1

      const { stream } = await fetchTransactionData(tx.id)

      if (stream) {
        const data = await streamToJson<DataBundleWrapper>(stream)

        try {
          await Promise.all([
            sequentialBatch(data.items, 100, async (items: DataBundleItem[]) => {
              await Promise.all(
                  items.map(async (item) => {
                    const contentType = getTagValue(item.tags, 'content-type')

                    const bundleData = fromB64Url(item.data)

                    await put('tx-data', `tx/${item.id}`, bundleData, {
                      contentType,
                    })
                  }),
              )
            }),
            sequentialBatch(data.items, 5, async (items: DataBundleItem[]) => {
              await Promise.all(
                  items.map(async (item) => {
                    const contentType = getTagValue(item.tags, 'content-type')

                    const bundleData = fromB64Url(item.data)

                    log.info('[import-bundles] importing tx bundle item', {
                      attempts,
                      bundle: tx.id,
                      item: item.id,
                      contentType,
                      contentLength: bundleData.byteLength,
                    })
                    await saveBundleDataItem(pool, item, { parent: tx.id })
                  }),
              )
            }),
          ])
          await complete(pool, tx.id, { attempts })
        } catch (error) {
          log.error('error', error?.message)
          await retry(pool, tx, { attempts: incrementedAttempts })
        }
      } else {
        log.error('Data not available, requeuing')
        await retry(pool, tx, { attempts: incrementedAttempts })
      }
    },
    {
      before: async () => {
        log.info(`[import-bundles] handler:before database connection init`)
        initConnectionPool('write')
      },
      after: async () => {
        log.info(`[import-bundles] handler:after database connection cleanup`)
        await releaseConnectionPool('write')
      },
    },
)

const retry = async (
    connection: Knex,
    header: TransactionHeader,
    { attempts }: { attempts: number },
) => {
  if (attempts && attempts >= MAX_RETRY) {
    return saveBundleStatus(connection, [
      {
        id: header.id,
        status: 'error',
        attempts,
      },
    ])
  }
  return Promise.all([
    saveBundleStatus(connection, [
      {
        id: header.id,
        status: 'pending',
        attempts,
      },
    ]),
    enqueue<ImportBundle>(
        getQueueChannel('import-bundles'),
        { header },
        { delaySeconds: attempts * RETRY_BACKOFF_SECONDS },
    ),
  ])
}

const complete = async (
    connection: Knex,
    id: string,
    { attempts }: { attempts: number },
) => {
  await saveBundleStatus(connection, [
    {
      id,
      status: 'complete',
      attempts,
    },
  ])
}
