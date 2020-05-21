import { RDS } from "aws-sdk";
import knex from "knex";

export type ConnectionMode = "read" | "write";

export type DBConnection = knex | knex.Transaction;

let poolCache: {
  read: null | knex;
  write: null | knex;
} = {
  read: null,
  write: null,
};

export const getConnectionPool = (mode: ConnectionMode): knex => {
  if (poolCache[mode]) {
    console.log(`Reusing connection: ${mode}`);
    return (poolCache[mode] = createConnectionPool(mode));
  }
  console.log(`Creating connection: ${mode}`);
  return (poolCache[mode] = createConnectionPool(mode));
};

export const releaseConnectionPool = async (
  mode?: ConnectionMode
): Promise<void> => {
  if (mode) {
    if (poolCache[mode]) {
      console.log(`Destroying connection: ${mode}`);
      await poolCache[mode]!.destroy();
      poolCache[mode] = null;
    }
  } else {
    await Promise.all([
      releaseConnectionPool("read"),
      releaseConnectionPool("write"),
    ]);
  }
};

interface PoolConfig {
  min: number;
  max: number;
}

export const createConnectionPool = (
  mode: ConnectionMode,
  { min, max }: PoolConfig = { min: 0, max: 10 }
): knex => {
  const host = {
    read: process.env.ARWEAVE_DB_READ_HOST,
    write: process.env.ARWEAVE_DB_WRITE_HOST,
  }[mode];

  console.log("Connecting to db", mode, host, process.env.ARWEAVE_DB_SCHEMA);

  const client = knex({
    client: "pg",
    pool: {
      min,
      max,
      acquireTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 40000,
    },
    connection: () => {
      console.log("Authenticating new connection");
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

interface UpsertOptions<T = object[]> {
  table: string;
  conflictKeys: string[];
  rows: T;
}

/**
 * Generate a postgres upsert statement. This manually appends a raw section to the query.
 *
 * INSERT (col, col, col) VALUES (val, val, val) ON CONFLICT (id,index) SO UPDATE SET x = excluded.x...
 */
export const upsert = (
  connection: DBConnection,
  { table, conflictKeys, rows }: UpsertOptions
) => {
  const updateFields = Object.keys(rows[0])
    .filter((field) => !conflictKeys.includes(field))
    .map((field) => `${field} = excluded.${field}`)
    .join(",");

  const { sql, bindings } = connection.insert(rows).into(table).toSQL();

  const upsertSql = sql.concat(
    ` ON CONFLICT (${conflictKeys.join(",")}) DO UPDATE SET ${updateFields};`
  );

  console.log("Query", upsertSql, bindings);

  return connection.raw(upsertSql, bindings);
};
