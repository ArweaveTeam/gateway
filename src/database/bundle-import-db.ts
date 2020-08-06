import { upsert } from "./postgres";
import Knex from "knex";
import { String } from "aws-sdk/clients/acm";

export interface DataBundleStatus {
  id: string;
  status: "pending" | "complete" | "error";
  attempts: number;
  error: string | null;
}

const table = "bundle_status";

const fields = ["id", "status", "attempts", "error"];

export const saveBundleStatus = async (
  connection: Knex,
  rows: Partial<DataBundleStatus>[]
) => {
  return upsert(connection, {
    table,
    conflictKeys: ["id"],
    rows,
  });
};

export const getBundleImport = async (
  connection: Knex,
  id: string
): Promise<Partial<DataBundleStatus>> => {
  const result = await connection
    .select<DataBundleStatus[]>(fields)
    .from("bundle_status")
    .where({ id })
    .first();

  if (result) {
    return {
      id: result.id,
      status: result.status,
      attempts: result.attempts,
      error: result.error,
    };
  }

  return {};
};
