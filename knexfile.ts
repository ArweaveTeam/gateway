import { config as env } from "dotenv";
import { Config } from "knex";

env();

module.exports = {
  dev: {
    client: "pg",
    schemaName: process.env.KNEX_ENVIRONMENT,
    connection: {
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "migrations",
      loadExtensions: [".ts"],
      extension: "ts",
      directory: "./migrations",
      schemaName: process.env.KNEX_ENVIRONMENT,
    },
  },
} as Config;
