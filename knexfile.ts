import { config as env } from "dotenv";
import { RDS } from "aws-sdk";
import { Config } from "knex";

env();

module.exports = {
  dev: {
    client: "pg",
    schemaName: process.env.KNEX_ENVIRONMENT,
    connection: {
      host: process.env.ARWEAVE_DB_WRITE_HOST,
      database: "arweave",
      user: "dev",
      ssl: {
        rejectUnauthorized: false,
      },
      /**
       * This will generate a database access token for the current IAM user and role,
       * i.e. your currently active aws-vault profile
       * https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html
       */
      password: new RDS.Signer().getAuthToken({
        region: process.env.AWS_REGION,
        hostname: process.env.ARWEAVE_DB_WRITE_HOST,
        port: 5432,
        username: "dev",
      }),
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
