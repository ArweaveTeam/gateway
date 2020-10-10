import knex from "knex";
interface UpsertOptions<T = object[]> {
  table: string;
  conflictKeys: string[];
  updateKeys: string[];
  rows: T;
  transaction?: knex.Transaction;
}

/**
 * Generate a postgres upsert statement.
 *
 * This manually appends a raw clause onto a standard knex update statement.
 *
 * INSERT
 *  (col, col, col)
 * VALUES
 *  (val, val, val)
 * ON CONFLICT ("some", "keys") DO UPDATE SET "x" = excluded."x"...
 */
export const upsert = (
  connection: knex | knex.Transaction,
  { table, conflictKeys, updateKeys, rows, transaction }: UpsertOptions
): knex.Raw => {
  // ['key1', 'key2'] => `"key1","key2"`
  const conflictFieldsFragment = conflictKeys
    .map((key) => `"${key}"`)
    .join(",");

  // ['key1', 'key2'] => `"key1" = excluded."key1", "key1" = excluded."key2"`
  const updateFieldsFragment = updateKeys
    .map((field) => `"${field}" = excluded."${field}"`)
    .join(",");

  const query = connection.insert(rows).into(table);

  if (transaction) {
    query.transacting(transaction);
  }

  const { sql, bindings } = query.toSQL();

  const upsertSql = sql.concat(
    ` ON CONFLICT (${conflictFieldsFragment}) DO UPDATE SET ${updateFieldsFragment};`
  );

  return connection.raw(upsertSql, bindings);
};
