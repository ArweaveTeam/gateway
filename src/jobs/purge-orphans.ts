import { getConnectionPool, releaseConnectionPool } from "../database/postgres";

import knex from "knex";

let pool: knex;

export const handler = async () => {
  try {
    pool = getConnectionPool("write");
    console.log(
      await pool.raw(
        `update transactions set deleted_at = now() where id not in (select tx_id from blocks_tx_map) and created_at < NOW() - INTERVAL '60 minutes' and deleted_at is NULL`
      )
    );
  } catch (error) {
    console.error(error);
  } finally {
    await releaseConnectionPool();
  }
};
