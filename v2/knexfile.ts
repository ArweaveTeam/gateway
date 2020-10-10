import { Config } from "knex";
import { config as loadEnv } from "dotenv";

loadEnv();

module.exports = {
  development: {
    client: "pg",
    connection: process.env.PG_WRITE_CONNECTION,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
      loadExtensions: [".ts"],
      extension: "ts",
      directory: "./database/migrations",
    },
  },
} as Config;
