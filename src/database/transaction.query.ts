import moment from 'moment'
import knex from 'knex'

import log from '../lib/log'
import { getConnectionPool } from './postgres'
import { Transaction } from '../lib/arweave.transaction'
import { ISO8601DateTimeString } from '../lib/encoding'
import { TagFilter } from '../gateway/routes/graphql-v2/schema/types'
import { saveTx } from './transaction.database'

type TxSortOrder = 'HEIGHT_ASC' | 'HEIGHT_DESC';

const orderByClauses = {
  HEIGHT_ASC: 'transactions.height ASC NULLS LAST, id ASC',
  HEIGHT_DESC: 'transactions.height DESC NULLS FIRST, id ASC',
}

interface TxQuery {
  to?: string[];
  from?: string[];
  id?: string;
  ids?: string[];
  tags?: TagFilter[];
  limit?: number;
  offset?: number;
  select?: any;
  blocks?: boolean;
  since?: ISO8601DateTimeString;
  sortOrder?: TxSortOrder;
  status?: 'any' | 'confirmed' | 'pending';
  pendingMinutes?: number;
  minHeight?: number;
  maxHeight?: number;
}

export async function query(connection: knex, params: TxQuery): Promise<knex.QueryBuilder> {
  const { to, from, tags, id, ids, status, select, since } = params
  const { limit = 10, blocks = false, sortOrder = 'HEIGHT_DESC', pendingMinutes = 60 } = params
  const { offset = 0, minHeight = -1, maxHeight = -1 } = params

  const query = connection
      .queryBuilder()
      .select(select || { id: 'transactions.id', height: 'transactions.height', tags: 'transactions.tags' })
      .from('transactions')

  if (id) {
    query.where('transactions.id', id)

    try {
      const writeConnection = getConnectionPool('write')
      const tx = await Transaction(id)
      await saveTx(writeConnection, tx)
    } catch (error) {
      log.error(error)
    }
  }

  if (ids) {
    query.whereIn('transactions.id', ids)

    for (let i = 0; i < ids.length; i++) {
      const item = ids[i]
      const writeConnection = getConnectionPool('write')

      try {
        const tx = await Transaction(item)
        await saveTx(writeConnection, tx)
      } catch (error) {
        log.error(error)
      }
    }
  }

  if (blocks) {
    query.leftJoin('blocks', 'transactions.height', 'blocks.height')
  }

  query.where((q) => {
    return q
        .whereNotNull('transactions.height')
        .orWhere('transactions.created_at', '>', moment().subtract(pendingMinutes, 'minutes').toISOString())
  })

  if (status === 'confirmed') {
    query.whereNotNull('transactions.height')
  }

  if (since) {
    query.where('transactions.created_at', '<', since)
  }

  if (to) {
    query.whereIn('transactions.target', to)
  }

  if (from) {
    query.whereIn('transactions.owner_address', from)
  }

  if (tags) {
    tags.forEach((tag, index) => {
      const tagAlias = `${index}_${index}`

      query.join(`tags as ${tagAlias}`, (join) => {
        join.on('transactions.id', `${tagAlias}.tx_id`)

        join.andOnIn(`${tagAlias}.name`, [tag.name])

        if (tag.op === 'EQ') {
          join.andOnIn(`${tagAlias}.value`, tag.values)
        }

        if (tag.op === 'NEQ') {
          join.andOnNotIn(`${tagAlias}.value`, tag.values)
        }
      })
    })
  }

  if (minHeight >= 0) {
    query.where('transactions.height', '>=', minHeight)
  }

  if (maxHeight >= 0) {
    query.where('transactions.height', '<=', maxHeight)
  }

  query.limit(limit).offset(offset)

  if (Object.keys(orderByClauses).includes(sortOrder)) {
    query.orderByRaw(orderByClauses[sortOrder])
  }

  return query
};
