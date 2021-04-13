import {config} from 'dotenv';
import {QueryBuilder} from 'knex';
import {indices} from '../utility/order.utility';
import {connection} from '../database/connection.database';
import {ISO8601DateTimeString} from '../utility/encoding.utility';
import {TagFilter} from './types';
import {tagToB64, toB64url} from '../query/transaction.query';

config();

export type TxSortOrder = 'HEIGHT_ASC' | 'HEIGHT_DESC';

export const orderByClauses = {
  HEIGHT_ASC: 'transactions.height ASC',
  HEIGHT_DESC: 'transactions.height DESC',
};

export interface QueryParams {
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

export async function generateQuery(params: QueryParams): Promise<QueryBuilder> {
  const {to, from, tags, id, ids, status = 'confirmed', select} = params;
  const {limit = 10, sortOrder = 'HEIGHT_DESC'} = params;
  const {since, offset = 0, minHeight = -1, maxHeight = -1} = params;

  const query = connection
      .queryBuilder()
      .select(select || {id: 'transactions.id', height: 'transactions.height', tags: 'transactions.tags'})
      .from('transactions');

  if (id) {
    query.where('transactions.id', id);
  }

  if (ids) {
    query.whereIn('transactions.id', ids);
  }

  query.leftJoin('blocks', 'transactions.height', 'blocks.height');

  if (since) {
    query.where('blocks.mined_at', '<', since);
  }

  if (status === 'confirmed') {
    query.whereNotNull('transactions.height');
  }

  if (to) {
    query.whereIn('transactions.target', to);
  }

  if (from) {
    query.whereIn('transactions.owner_address', from);
  }

  if (tags) {
    const tagsConverted = tagToB64(tags);

    const subQuery = connection
      .queryBuilder()
      .select(`*`)
      .from(`tags`);

    let runSubQuery = false;

    for (let i = 0; i < tagsConverted.length; i++) {
      const tag = tagsConverted[i];
      let indexed = false;

      for (let ii = 0; ii < indices.length; ii++) {
        const index = toB64url(indices[ii]);

        if (tag.name === index) {
          indexed = true;
          query.whereIn(`transactions.${index}`, tag.values);
        }
      }

      if (indexed === false) {
        subQuery.where(`name`, tag.name);
        subQuery.whereIn(`value`, tag.values);
        runSubQuery = true;
      }
    }

    if (runSubQuery) {
      const results = await subQuery;
      const tx_ids = [];

      for (let i = 0; i < results.length; i++) {
        const {tx_id} = results[i];
        tx_ids.push(tx_id);
      }

      query.whereIn('transactions.id', tx_ids);
    }
  }

  if (minHeight >= 0) {
    query.where('transactions.height', '>=', minHeight);
  }

  if (maxHeight >= 0) {
    query.where('transactions.height', '<=', maxHeight);
  }

  query.limit(limit).offset(offset);

  if (Object.keys(orderByClauses).includes(sortOrder)) {
    query.orderByRaw(orderByClauses[sortOrder]);
  }

  return query;
}

export const blockOrderByClauses = {
  HEIGHT_ASC: 'blocks.height ASC NULLS LAST, id ASC',
  HEIGHT_DESC: 'blocks.height DESC NULLS FIRST, id ASC',
};

export type BlockSortOrder = 'HEIGHT_ASC' | 'HEIGHT_DESC';

export interface BlockQueryParams {
  id?: string;
  ids?: string[];
  limit?: number;
  offset?: number;
  select?: any;
  before?: ISO8601DateTimeString;
  sortOrder?: BlockSortOrder;
  minHeight?: number;
  maxHeight?: number;
}

export async function generateBlockQuery(params: BlockQueryParams): Promise<QueryBuilder> {
  const {id, ids, limit, offset, select, before, sortOrder, minHeight, maxHeight} = params;

  const query = connection.queryBuilder().select(select).from('blocks');

  if (id) {
    query.where('blocks.id', id);
  }

  if (ids) {
    query.whereIn('blocks.id', ids);
  }

  if (before) {
    query.where('blocks.created_at', '<', before);
  }

  if (minHeight && minHeight >= 0) {
    query.where('blocks.height', '>=', minHeight);
  }

  if (maxHeight && maxHeight >= 0) {
    query.where('blocks.height', '<=', maxHeight);
  }

  if (limit) {
    query.limit(limit);
  }

  if (offset) {
    query.offset(offset);
  }

  if (sortOrder) {
    if (Object.keys(blockOrderByClauses).includes(sortOrder)) {
      query.orderByRaw(blockOrderByClauses[sortOrder]);
    }
  }

  return query;
}
