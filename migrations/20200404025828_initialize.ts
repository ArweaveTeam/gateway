import * as Knex from 'knex';
import {config} from 'dotenv';

config();

export async function up(knex: Knex) {
  const indices = JSON.parse(process.env.INDICES || '[]');

  return knex.schema
      .withSchema(process.env.ENVIRONMENT || 'public')
      .createTable('transactions', (table) => {
        table.string('id', 64).notNullable();
        table.text('owner');
        table.jsonb('tags');
        table.string('target', 64);
        table.text('quantity');
        table.text('reward');
        table.text('signature');
        table.text('last_tx');
        table.bigInteger('data_size');
        table.string('content_type');
        table.integer('format', 2);
        table.integer('height', 4);
        table.string('owner_address');
        table.string('data_root', 64);
        table.string('parent', 64);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        for (let i = 0; i < indices.length; i++) {
          const index = indices[i];
          table.string(index, 64);
          table.index(index, `index_${index}_transactions`, 'BTREE');
        }

        table.primary(['id'], 'pkey_transactions');
        table.index(['height'], 'transactions_height', 'BTREE');
        table.index(['owner_address'], 'transactions_owner_address', 'BTREE');
        table.index(['target'], 'transactions_target', 'BTREE');
      })
      .createTable('blocks', (table) => {
        table.string('id', 64).notNullable();
        table.integer('height', 4).notNullable();
        table.timestamp('mined_at').notNullable();
        table.string('previous_block').notNullable();
        table.jsonb('txs').notNullable();
        table.jsonb('extended');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.primary(['id'], 'pkey_blocks');
        table.index(['height'], 'blocks_height', 'BTREE');
        table.index(['mined_at'], 'blocks_mined_at', 'BTREE');
      })
      .createTable('tags', (table) => {
        table.string('tx_id', 64).notNullable();
        table.integer('index').notNullable();
        table.text('name');
        table.text('value');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.primary(['tx_id', 'index'], 'pkey_tags');
        table.index(['tx_id', 'name'], 'tags_tx_id_name', 'BTREE');
        table.index(['name'], 'tags_name', 'BTREE');
        table.index(['value'], 'tags_value', 'BTREE');
        table.index(['name', 'value'], 'tags_name_value', 'BTREE');
      });
}

export async function down(knex: Knex) {
  return knex.schema
      .withSchema(process.env.ENVIRONMENT || 'public')
      .dropTableIfExists('transactions')
      .dropTableIfExists('blocks')
      .dropTableIfExists('tags');
}
