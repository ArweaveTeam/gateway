import { parse } from "pg-connection-string";
import knex from "knex";
import { useRdsIamAuth, getRdsIamAuthToken } from "../rds/iam-auth";

type Connection = (
  mode: ConnectionMode,
  options?: ConnectionPoolConfig
) => knex;

export type ConnectionMode = "read" | "write";

export type ConnectionPoolConfig = { pool?: { min?: number; max?: number } };

export const createConnectionPool: Connection = (
  mode,
  { pool = {} } = {}
): knex => {
  return knex({
    client: "pg",
    pool: {
      min: pool.min || parseInt(process.env.PG_POOL_MIN || "1"),
      max: pool.max || parseInt(process.env.PG_POOL_MIN || "10"),
      acquireTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 40000,
    },
    connection: () => {
      const str = getConnectionString(mode);

      console.log(str);
      const { user, password, host, port, database } = parseConnectionString(
        str
      );

      const connectionDisplayName = `${process.env.AWS_REGION} postgres://${user}:[password-redacted]@${host}:${port}/${database}`;

      console.log(`[postgres] connecting to db: ${connectionDisplayName}`);
      return {
        host,
        port,
        user,
        database,
        password: useRdsIamAuth()
          ? getRdsIamAuthToken({ host, port, user })
          : password,
        ssl: {
          rejectUnauthorized: false,
        },
        expirationChecker: () => true,
      };
    },
  });
};

const getConnectionString = (mode: ConnectionMode): string => {
  const connectionString = {
    read: process.env.PG_READ_CONNECTION,
    write: process.env.PG_WRITE_CONNECTION,
  }[mode];

  if (!connectionString) {
    throw new Error(
      `Missing postgres environment string read=PG_READ_CONNECTION, write=PG_WRITE_CONNECTION, mode=${mode}`
    );
  }

  return connectionString;
};

const parseConnectionString = (connectionString: string) => {
  const { user, password, host, port, database } = parse(connectionString);

  return {
    user: user || "",
    password: password || "",
    host: host || "",
    port: port ? parseInt(port) : 5432,
    database: database || "",
  };
};
