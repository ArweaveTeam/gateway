import knex from 'knex'
import log from '../lib/log'
import { getConnectionPool } from '../database/postgres'
import { Block } from '../lib/arweave'
import { CurrentBlock as GetCurrentBlock, Block as GetBlock } from '../lib/arweave.block'
import { Transaction } from '../lib/arweave.transaction'
import { saveBlocks, fullBlockToDbBlock } from '../database/block.database'
import { saveTx } from '../database/transaction.database'

export async function ImportData() {
  log.info(`[database] Started job to import blocks`)

  const CurrentBlock = await GetCurrentBlock()
  const AsBlock = fullBlockToDbBlock(CurrentBlock as Block)
  const connection: knex = getConnectionPool('write')

  await saveBlocks(connection, [AsBlock])
  await SaveTransactions(connection, CurrentBlock.txs, CurrentBlock.height)

  TraverseChain(connection, CurrentBlock.height - 1)

  log.info(`[database] Saved block ${CurrentBlock.height} with ${CurrentBlock.txs.length} transactions`)
}

export async function TraverseChain(connection: knex, height: number) {
  const Block = await GetBlock(height)
  const AsBlock = fullBlockToDbBlock(Block as Block)

  await saveBlocks(connection, [AsBlock])
  await SaveTransactions(connection, Block.txs, Block.height)

  log.info(`[database] Saved block ${Block.height} with ${Block.txs.length} transactions`)

  TraverseChain(connection, Block.height - 1)
}

export async function SaveTransactions(connection: knex, txs: string[], height: number) {
  for (let i = 0; i < txs.length; i++) {
    const tx = await Transaction(txs[i])
    tx.height = height
    await saveTx(connection, tx)
  }
}
