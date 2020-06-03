import {
  getConnectionPool,
  releaseConnectionPool,
  createConnectionPool,
  initConnectionPool,
} from "../database/postgres";

import knex from "knex";
import { wait } from "../lib/helpers";

let pool: knex;

export const handler = async () => {
  initConnectionPool("write");
  await wait(500);

  try {
    pool = getConnectionPool("write");
    console.log(
      await pool.raw(
        `update transactions set deleted_at = now() where height is null and created_at < NOW() - INTERVAL '60 minutes' and deleted_at is NULL`
      )
    );
  } catch (error) {
    console.error(error);
  }

  await releaseConnectionPool();
  await wait(500);
};
