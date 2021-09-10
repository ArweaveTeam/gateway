import moment from 'moment';
import {connection} from './connection.database';
import {BlockType} from '../query/block.query';
import {TransactionType, tagValue, Tag} from '../query/transaction.query';
import {getExtendedFields} from './block.database';
import {fromB64Url, sha256B64Url} from '../utility/encoding.utility';

export async function insertBlock(block: BlockType) {
  return await connection
      .table('blocks')
      .insert({
        id: block.indep_hash,
        height: block.height,
        mined_at: moment(block.timestamp * 1000).format(),
        previous_block: block.previous_block,
        txs: JSON.stringify(block.txs),
        extended: getExtendedFields(block),
      })
      .onConflict('id' as never)
      .ignore();
}

export async function insertTransaction(tx: TransactionType, height: number) {
  return await connection
      .table('transactions')
      .insert({
        id: tx.id,
        owner: tx.owner,
        tags: JSON.stringify(tx.tags),
        target: tx.target,
        quantity: tx.quantity,
        reward: tx.reward,
        signature: tx.signature,
        last_tx: tx.last_tx,
        data_size: tx.data_size,
        content_type: tagValue(tx.tags, 'content-type'),
        format: tx.format,
        height,
        owner_address: tx.owner.length > 64 ? sha256B64Url(fromB64Url(tx.owner)) : tx.owner,
        data_root: tx.data_root,
        parent: tx.parent,
      })
      .onConflict('id' as never)
      .ignore();
}

export async function insertTag(tx_id: string, tags: Array<Tag>) {
  const preparedTags = [];

  for (let i = 0; i < tags.length; i++) {
    preparedTags.push({
      tx_id,
      index: i,
      name: tags[i].name,
      value: tags[i].value,
    });
  }

  return await connection
      .table('tags')
      .insert(preparedTags)
      .onConflict(['tx_id' as never, 'index' as never])
      .ignore();
}
