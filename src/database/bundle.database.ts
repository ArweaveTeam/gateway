import { upsert } from './postgres'
import knex from 'knex'

import { DataBundleItem } from '../lib/arweave'
import { fromB64Url, sha256B64Url } from '../lib/encoding'
import { txTagsToRows } from './transaction.database'

export interface DataBundleStatus {
  id: string;
  status: 'pending' | 'complete' | 'error';
  attempts: number;
  error: string | null;
}

const table = 'bundle_status'

const fields = ['id', 'status', 'attempts', 'error']

export async function saveBundleStatus(connection: knex, rows: Partial<DataBundleStatus>[]) {
  return upsert(connection, {
    table,
    conflictKeys: ['id'],
    rows,
  })
};

export async function getBundleImport(connection: knex, id: string): Promise<Partial<DataBundleStatus>> {
  const result = await connection
      .select<DataBundleStatus[]>(fields)
      .from('bundle_status')
      .where({ id })
      .first()

  if (result) {
    return {
      id: result.id,
      status: result.status,
      attempts: result.attempts,
      error: result.error,
    }
  }

  return {}
};

export async function saveBundleDataItem(connection: knex, tx: DataBundleItem, { parent } : { parent: string }) {
  return await connection.transaction(async (knexTransaction) => {
    await upsert(knexTransaction, {
      table: 'transactions',
      conflictKeys: ['id'],
      rows: [
        {
          parent,
          format: 1,
          id: tx.id,
          signature: tx.signature,
          owner: tx.owner,
          owner_address: sha256B64Url(fromB64Url(tx.owner)),
          target: tx.target,
          reward: 0,
          last_tx: tx.nonce,
          tags: JSON.stringify(tx.tags),
          quantity: 0,
          data_size: fromB64Url((tx as any).data).byteLength,
        },
      ],
    })

    if (tx.tags.length > 0) {
      await upsert(knexTransaction, {
        table: 'tags',
        conflictKeys: ['tx_id', 'index'],
        rows: txTagsToRows(tx.id, tx.tags),
      })
    }
  })
};
