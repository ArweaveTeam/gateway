import { pick } from 'lodash';
import { TransactionType, tagValue } from '../query/transaction.query';
import { fromB64Url, sha256B64Url } from '../utility/encoding.utility';

export interface DatabaseTag {
    transaction: string;
    index: number;
    name: string | undefined;
    value: string | undefined;
}

export const transactionFields = [
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
];

export function formatTransaction(transaction: TransactionType) {
    return pick(
        {
            ...transaction,
            content_type: tagValue(transaction.tags, 'content-type'),
            format: transaction.format || 0,
            data_size: transaction.data_size || transaction.data ? fromB64Url(transaction.data).byteLength : undefined,
            tags: JSON.stringify(transaction.tags),
            owner_address: sha256B64Url(fromB64Url(transaction.owner)),
        },
        transactionFields,
    );
}