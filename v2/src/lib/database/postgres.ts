import knex from "knex";

import {
  createConnectionPool,
  ConnectionMode,
  ConnectionPoolConfig,
} from "./postgres-connection";

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
