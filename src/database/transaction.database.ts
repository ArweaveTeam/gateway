import knex from 'knex'
import { pick } from 'lodash'

import { upsert } from './postgres'
import { TransactionType, TagValue } from '../lib/arweave.transaction'
import { TransactionHeader, Tag, utf8DecodeTag, DataBundleItem } from '../lib/arweave'
import { fromB64Url, sha256B64Url } from '../lib/encoding'

interface DatabaseTag {
    tx_id: string;
    index: number;
    name: string | undefined;
    value: string | undefined;
}

const txFields = [
  'format',
  'id',
  'signature',
  'owner',
  'owner_address',
  'target',
  'reward',
  'last_tx',
  'height',
  'tags',
  'quantity',
  'content_type',
  'data_size',
  'data_root',
]

export async function getTxIds(connection: knex, predicates: object): Promise<string[]> {
  return await connection.pluck('id').from('transactions').where(predicates)
};

export async function getTx(connection: knex, predicates: object): Promise<any | undefined> {
  return connection.select().from('transactions').where(predicates).first()
};

export const hasTx = async (connection: knex, id: string): Promise<boolean> => {
  const result = await connection
      .first('id')
      .from('transactions')
      .where({ id })
      .whereNotNull('owner')

  return !!(result && result.id)
}

export const hasTxs = async (connection: knex, ids: string[]): Promise<string[]> => {
  return await connection
      .pluck('id')
      .from('transactions')
      .whereIn('id', ids)
}

export const saveTx = async (connection: knex, tx: TransactionType | TransactionHeader): Promise<boolean> => {
  return await connection.transaction(async (knexConnection) => {
    await upsert(knexConnection, {
      table: 'transactions',
      conflictKeys: ['id'],
      rows: [txToRow({ tx })],
      transaction: knexConnection,
    })

    if (tx.tags.length > 0) {
      await upsert(knexConnection, {
        table: 'tags',
        conflictKeys: ['tx_id', 'index'],
        rows: txTagsToRows(tx.id, tx.tags),
        transaction: knexConnection,
      })
    }

    return true
  })
}

export const saveTxs = async (connection: knex, txs: TransactionType[] | TransactionHeader[]): Promise<boolean> => {
  return await connection.transaction(async (knexConnection) => {
    const queries = []

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i]

      queries.push(
          await upsert(knexConnection, {
            table: 'transactions',
            conflictKeys: ['id'],
            rows: [txToRow({ tx })],
            transaction: knexConnection,
          }),
      )

      if (tx.tags.length > 0) {
        queries.push(
            await upsert(knexConnection, {
              table: 'tags',
              conflictKeys: ['tx_id', 'index'],
              rows: txTagsToRows(tx.id, tx.tags),
              transaction: knexConnection,
            }),
        )
      }
    }

    await Promise.all(queries)

    return true
  })
}

export const txToRow = ({ tx }: { tx: TransactionType | TransactionHeader | DataBundleItem }) => {
  return pick({
    ...tx,
    content_type: TagValue(tx.tags, 'content-type'),
    format: (tx as any).format || 0,
    data_size: (tx as any).data_size || ((tx as any).data ? fromB64Url((tx as any).data).byteLength : undefined),
    tags: JSON.stringify(tx.tags),
    owner_address: sha256B64Url(fromB64Url(tx.owner)),
  }, txFields)
}

export const txTagsToRows = (tx_id: string, tags: Tag[]): DatabaseTag[] => {
  return tags.map((tag, index) => {
    const { name, value } = utf8DecodeTag(tag)
    return { tx_id, index, name, value }
  })
}
