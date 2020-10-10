import knex from "knex";

import {
  createConnectionPool,
  ConnectionMode,
  ConnectionPoolConfig,
} from "./postgres";

import { upsert as postgresUpsert } from "./postgres/upsert";

const poolCache: {
  read?: knex;
  write?: knex;
} = {};

export const getConnectionPool = (
  mode: ConnectionMode,
  options: ConnectionPoolConfig
): knex => {
  const cachedConnection = poolCache[mode];

  if (cachedConnection) {
    return cachedConnection;
  }

  return (poolCache[mode] = createConnectionPool(mode, options));
};

export const upsert = postgresUpsert;
