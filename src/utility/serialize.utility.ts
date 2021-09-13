import {DataItemJson} from 'arweave-bundles';
import {BlockType} from '../query/block.query';
import {TransactionType, Tag} from '../query/transaction.query';
import {formatBlock} from '../database/block.database';
import {formatTransaction, transactionFields, formatAnsTransaction} from '../database/transaction.database';

export const delimiter = '|';

export function serializeBlock(block: BlockType, height: number) {
  const formattedBlock = formatBlock(block);
  const values = [`"${formattedBlock.id}"`, `"${formattedBlock.previous_block}"`, `"${formattedBlock.mined_at}"`, `"${formattedBlock.height}"`, `"${formattedBlock.txs.replace(/"/g, '\\"')}"`, `"${formattedBlock.extended.replace(/"/g, '\\"')}"`];

  const input = `${values.join(delimiter)}\n`;

  return {
    formattedBlock,
    input,
  };
}

export function serializeTransaction(tx: TransactionType, height: number) {
  const formattedTransaction: any = formatTransaction(tx);
  const preservedTags = JSON.parse(formattedTransaction.tags) as Array<Tag>;
  formattedTransaction.tags = `${formattedTransaction.tags.replace(/"/g, '\\"')}`;

  const values = transactionFields
      .map((field) => `"${field === 'height' ? height : formattedTransaction[field] ? formattedTransaction[field] : ''}"`);

  const input = `${values.join(delimiter)}\n`;

  return {
    formattedTransaction,
    preservedTags,
    input,
  };
}

export function serializeAnsTransaction(tx: DataItemJson, height: number) {
  const formattedAnsTransaction: any = formatAnsTransaction(tx);
  formattedAnsTransaction.tags = `${formattedAnsTransaction.tags.replace(/"/g, '\\"')}`;

  const ansTags = tx.tags;

  const values = transactionFields
      .map((field) => `"${field === 'height' ? height : formattedAnsTransaction[field] ? formattedAnsTransaction[field] : ''}"`);

  const input = `${values.join(delimiter)}\n`;

  return {
    formattedAnsTransaction,
    ansTags,
    input,
  };
}

export function serializeTags(tx_id: string, index: number, tag: Tag) {
  const values = [`"${tx_id}"`, `"${index}"`, `"${tag.name}"`, `"${tag.value}"`];
  const input = `${values.join(delimiter)}\n`;
  return {input};
}
