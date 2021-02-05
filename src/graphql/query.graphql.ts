import {QueryBuilder} from 'knex';
import {connection} from '../database/connection.database';
import {ISO8601DateTimeString} from '../utility/encoding.utility';
import {TagFilter} from './types';

export type TxSortOrder = 'HEIGHT_ASC' | 'HEIGHT_DESC';

export const orderByClauses = {
  HEIGHT_ASC: 'transactions.height ASC NULLS LAST, id ASC',
  HEIGHT_DESC: 'transactions.height DESC NULLS FIRST, id ASC',
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
  const {to, from, tags, id, ids, status, select, since} = params;
  const {limit = 10, blocks = false, sortOrder = 'HEIGHT_DESC'} = params;
  const {offset = 0, minHeight = -1, maxHeight = -1} = params;

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

  if (blocks) {
    query.leftJoin('blocks', 'transactions.height', 'blocks.height');
  }

  if (status === 'confirmed') {
    query.whereNotNull('transactions.height');
  }

  if (since) {
    query.where('transactions.created_at', '<', since);
  }

  if (to) {
    query.whereIn('transactions.target', to);
  }

  if (from) {
    query.whereIn('transactions.owner_address', from);
  }

  if (tags) {
    tags.forEach((tag, index) => {
      const tagAlias = `${index}_${index}`;

      query.join(`tags as ${tagAlias}`, (join) => {
        join.on('transactions.id', `${tagAlias}.tx_id`);

        join.andOnIn(`${tagAlias}.name`, [tag.name]);

        if (tag.op === 'EQ') {
          join.andOnIn(`${tagAlias}.value`, tag.values);
        }

        if (tag.op === 'NEQ') {
          join.andOnNotIn(`${tagAlias}.value`, tag.values);
        }
      });
    });
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
