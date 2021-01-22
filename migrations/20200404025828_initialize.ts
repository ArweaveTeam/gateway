import * as Knex from "knex";

export async function up(knex: Knex): Promise<any> {
  return knex.schema
    .withSchema(process.env.ENVIRONMENT || "public")
    .createTable("transactions", table => {
      table.string("id", 64).notNullable();
      table.text("owner");
      table.jsonb("tags");
      table.string("target", 64);
      table.string("quantity");
      table.string("reward");
      table.text("signature");
      table.string("last_tx", 64);
      table.integer("data_size", 8);
      table.string("content_type");
      table.integer("format", 2);
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("deleted_at");
      table.integer("height", 4);
      table.string("owner_address");
      table.string("data_root", 64);
      table.string("parent", 64);

      table.primary(["id"], "pkey_transactions");
    })
    .createTable("tags", table => {
      table.string("tx_id", 43).notNullable();
      table.integer("index", 4).notNullable();
      table.string("name").notNullable();
      table.string("value").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());

      table.primary(["tx_id", "index"], "pkey_tags");
      table.index(["name", "value"], "index_name_value", "BTREE");
    })
    .createTable("blocks", table => {
      table.string("id", 43).notNullable();
      table.integer("height", 4).notNullable();
      table.timestamp("mined_at").notNullable();
      table.jsonb("txs").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.jsonb("extended");
      table.string("previous_block").notNullable();

      table.primary(["id"], "pkey_blocks");
    });
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema
    .withSchema(process.env.ENVIRONMENT || "public")
    .dropTableIfExists("transactions")
    .dropTableIfExists("tags")
    .dropTableIfExists("blocks");
}
