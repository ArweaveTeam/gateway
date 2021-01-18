import { config as env } from "dotenv";
import { Config } from "knex";

env();

module.exports = {
  client: "pg",
  schemaName: process.env.ENVIRONMENT,
  connection: {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD
  },
  pool: {
    min: 1,
    max: 10,
  },
  migrations: {
    tableName: "migrations",
    loadExtensions: [".ts"],
    extension: "ts",
    directory: "./migrations",
    schemaName: process.env.ENVIRONMENT,
  },
} as Config;