import knex from "knex";
import moment from "moment";

import { upsert } from "./postgres";

export interface DatabaseChunk {
  data_root: string;
  data_size: number;
  data_path: string;
  offset: number;
  chunk_size: number;
}

const chunkFields = [
  "data_root",
  "data_size",
  "data_path",
  "offset",
  "chunk_size",
];

export const saveChunk = async (connection: knex, chunk: DatabaseChunk) => {
  await upsert(connection, {
    table: "chunks",
    conflictKeys: ["data_root", "data_size", "offset"],
    rows: [chunk],
  });
};

interface ChunkQuery {
  limit?: number;
  offset?: number;
  root?: string;
  select?: (keyof DatabaseChunk)[];
  order?: "asc" | "desc";
}

export const query = (
  connection: knex,
  { select, order = "asc", root }: ChunkQuery
): knex.QueryBuilder<any, Partial<DatabaseChunk>[]> => {
  const query = connection
    .queryBuilder()
    .select(select || "*")
    .from("chunks");

  query.orderBy("offset", order);

  return query;
};

export const getPendingExports = async (
  connection: knex,
  { limit = 100 }: { limit: number }
): Promise<DatabaseChunk[]> => {
  // select * from chunks where data_root in
  // (select data_root from chunks group by data_root, data_size having sum(chunk_size) = data_size)
  // and exported_started_at is null order by created_at asc
  const query = connection
    .select(chunkFields)
    .from("chunks")
    .whereIn("data_root", (query) => {
      query
        .select("data_root")
        .from("chunks")
        .groupBy(["data_root", "data_size"])
        .havingRaw("sum(chunk_size) = data_size");
    })
    .whereNull("exported_started_at")
    .orderBy("created_at", "asc");

  if (limit) {
    query.limit(limit);
  }

  return query;
};

export const startedExport = async (
  connection: knex,
  chunk: {
    data_root: string;
    data_size: number;
    offset: number;
  }
) => {
  const query = connection
    .update({
      exported_started_at: moment().format(),
    })
    .from("chunks")
    .where(chunk);

  console.log(query.toSQL());

  await query;
};

export const completedExport = async (
  connection: knex,
  chunk: {
    data_root: string;
    data_size: number;
    offset: number;
  }
) => {
  await connection
    .update({
      exported_completed_at: moment().format(),
    })
    .from("chunks")
    .where(chunk);
};

export const queryRecentChunks = async (
  connection: knex,
  {
    root,
    size,
  }: {
    root: string;
    size: number;
  }
) => {
  return connection
    .select(["data_root", "data_size", "offset"])
    .from("chunks")
    .where({
      data_root: root,
      data_size: size,
    })
    .orderBy("offset", "asc");
};
