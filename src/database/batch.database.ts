import { Transaction, Sql } from 'knex';
import { connection } from './connection.database';
import { BlockType } from '../query/block.query';
import { transaction, TransactionType } from '../query/transaction.query';
import { formatBlock } from './block.database';
import { formatTransaction } from './transaction.database';

export function createBatchItem(batchScope: Transaction, table: string, rows: object): Sql {   
    return batchScope.insert(rows).into(table).toSQL();
}

export function createBlockBatchItem(batchScope: Transaction, block: BlockType): Sql {
    const formattedBlock = formatBlock(block);
    const batchItem = createBatchItem(batchScope, 'blocks', formattedBlock);
    return batchItem;
}

export function createTransactionBatchItem(batchScope: Transaction, transaction: TransactionType): Sql {
    const formattedTransaction = formatTransaction(transaction);
    const batchItem = createBatchItem(batchScope, 'transactions', formattedTransaction);
    return batchItem;
}

export async function storeBlock(block: BlockType) {
    connection.transaction(async batchScope => {
        const batch = [];

        batch.push(createBlockBatchItem(batchScope, block));
    
        for (let i = 0; i < block.txs.length; i++) {
            const tx = block.txs[i];
            const payload = await transaction(tx);
            batch.push(createTransactionBatchItem(batchScope, payload));
        }
    
        await Promise.all(batch);

        return true;
    });
}