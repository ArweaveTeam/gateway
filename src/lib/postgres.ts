import { RDS } from "aws-sdk";
import knex, { Transaction } from "knex";

type ConnectionMode = "read" | "write";

export const createConnection = (mode: ConnectionMode): knex => {
  const host = {
    read: process.env.ARWEAVE_DB_READ_HOST,
    write: process.env.ARWEAVE_DB_WRITE_HOST,
  }[mode];

  console.log("Connecting to db", mode, host, process.env.ARWEAVE_DB_SCHEMA);

  const client = knex({
    client: "pg",
    pool: { min: 0, max: 10, acquireTimeoutMillis: 10000 },
    connection: () => {
      return {
        host: host,
        user: mode,
        database: process.env.ARWEAVE_DB_SCHEMA,
        ssl: {
          rejectUnauthorized: false,
        },
        password: new RDS.Signer().getAuthToken({
          region: process.env.AWS_REGION,
          hostname: host,
          port: 5432,
          username: mode,
        }),
        expirationChecker: () => true,
      };
    },
  });

  return client;
};

interface UpsertOptions {
  table: string;
  conflictKeys: string[];
  rows: { [key: string]: any }[];
}

/**
 * Generate a postgres upsert statement. This manually appends a raw section to the query.
 *
 * INSERT (col, col, col) VALUES (val, val, val) ON CONFLICT (id,index) SO UPDATE SET x = excluded.x...
 */
export const upsert = (
  knexTransaction: knex.Transaction,
  { table, conflictKeys, rows }: UpsertOptions
) => {
  const updateFields = Object.keys(rows[0])
    .filter((field) => !conflictKeys.includes(field))
    .map((field) => `${field} = excluded.${field}`)
    .join(",");

  const { sql, bindings } = knexTransaction.into(table).insert(rows).toSQL();

  const upsertSql = sql.concat(
    ` ON CONFLICT (${conflictKeys.join(",")}) DO UPDATE SET ${updateFields};`
  );

  console.log("Query", upsertSql, bindings);

  return knexTransaction.raw(upsertSql, bindings);
};
