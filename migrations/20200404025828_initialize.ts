import * as Knex from "knex";

export async function up(knex: Knex): Promise<any> {
  return knex.schema
    .createSchemaIfNotExists(process.env.KNEX_ENVIRONMENT)
    .withSchema(process.env.KNEX_ENVIRONMENT)
    .createTable("transactions", function (table) {
      table.string("id", 43).notNullable();
      table.string("owner", 684).notNullable();
      table.string("target", 43).notNullable();
      table.string("content_type", 128).nullable();
      table.string("quantity").notNullable();
      table.string("reward").notNullable();
      table.string("signature", 684).notNullable();
      table.string("last_tx", 684).notNullable();
      table.integer("data_size", 8).nullable();
      table.string("data_root", 8).nullable();
      table.jsonb("data_tree").nullable();

      table.primary(["id"], "pkey_transactions");
    })
    .createTable("tags", function (table) {
      table.string("tx", 43).notNullable();
      table.specificType("index", "smallint").notNullable();
      table.string("name").notNullable();
      table.string("value").notNullable();

      table.primary(["tx", "index"], "pkey_tags");
      table.index(["name", "value"], "index_name_value", "BTREE");
    });
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema
    .withSchema(process.env.KNEX_ENVIRONMENT)
    .dropTableIfExists("transactions")
    .dropTableIfExists("tags");
}
