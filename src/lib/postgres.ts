import { RDS } from "aws-sdk";
import knex from "knex";

type ConnectionMode = "read" | "write";

export const createConnection = (mode: ConnectionMode): knex => {
  const host = {
    read: process.env.ARWEAVE_DB_READ_HOST,
    write: process.env.ARWEAVE_DB_WRITE_HOST
  }[mode];

  console.log("Connecting to db", mode, host, process.env.ARWEAVE_DB_SCHEMA);

  return knex({
    client: "pg",
    pool: { min: 0, max: 10, acquireTimeoutMillis: 10000 },
    connection: async () => {
      return {
        host: host,
        user: mode,
        database: process.env.ARWEAVE_DB_SCHEMA,
        ssl: true,
        password: new RDS.Signer().getAuthToken({
          region: process.env.AWS_REGION,
          hostname: host,
          port: 5432,
          username: mode
        }),
        expirationChecker: () => true
      };
    }
  });
};
