import { upsert } from "./postgres";
import knex, { QueryBuilder } from "knex";
import {
  TransactionHeader,
  getTagValue,
  Tag,
  utf8DecodeTag,
} from "../lib/arweave";
import { fromB64Url, sha256B64Url } from "../lib/encoding";
import { pick } from "lodash";
import { sequentialBatch } from "../lib/helpers";

const txFields = [
  "format",
  "id",
  "signature",
  "owner",
  "owner_address",
  "target",
  "reward",
  "last_tx",
  "tags",
  "quantity",
  "quantity",
  "content_type",
  "data_size",
];

export const getTxIds = async (
  connection: knex,
  predicates: object
): Promise<string[]> => {
  return await connection.pluck("id").from("transactions").where(predicates);
};

export const getTx = async (
  connection: knex,
  predicates: object
): Promise<any | undefined> => {
  return connection.select().from("transactions").where(predicates).first();
};

interface TxQuery {
  to?: string[];
  from?: string[];
  id?: string;
  tags?: { name: string; value: string }[];
  limit?: number;
  offset?: number;
  select?: string[];
  sort?: boolean;
}

export const query = (
  connection: knex,
  {
    to,
    from,
    tags,
    limit = 100000,
    offset = 0,
    id,
    select,
    sort = true,
  }: TxQuery
): knex.QueryBuilder => {
  const query = connection
    .queryBuilder()
    .select(select || ["id", "height", "transactions.tags"])
    .from("transactions");

  if (to) {
    query.whereIn("transactions.target", to);
  }

  if (id) {
    query.where("transactions.id", id);
  }

  if (from) {
    query.whereIn("transactions.owner_address", from);
  }

  if (tags) {
    tags.forEach((tag) => {
      query.whereIn("transactions.id", (query) => {
        query.select("tx_id").from("tags");
        if (tag.value.includes("%")) {
          query
            .where("tags.name", "=", tag.name)
            .where("tags.value", "LIKE", tag.value);
        } else {
          query.where({
            "tags.name": tag.name,
            "tags.value": tag.value,
          });
        }
      });
    });
  }

  query.limit(limit).offset(offset);

  if (sort) {
    query.orderByRaw("height desc NULLS first");
  }

  return query;
};

export const hasTx = async (connection: knex, id: string): Promise<boolean> => {
  const result = await connection
    .first("id")
    .from("transactions")
    .where({ id })
    .whereNotNull("owner");

  return !!(result && result.id);
};

export const hasTxs = async (
  connection: knex,
  ids: string[]
): Promise<string[]> => {
  return await connection.pluck("id").from("transactions").whereIn("id", ids);
};

export const saveTx = async (connection: knex, tx: TransactionHeader) => {
  return await connection.transaction(async (knexTransaction) => {
    const contentType = getTagValue(tx, "content-type");
    await upsert(knexTransaction, {
      table: "transactions",
      conflictKeys: ["id"],
      rows: [
        txToRow({
          tx,
          content_type: contentType || null,
          data_size: tx.data_size,
        }),
      ],
    });

    if (tx.tags.length > 0) {
      await upsert(knexTransaction, {
        table: "tags",
        conflictKeys: ["tx_id", "index"],
        rows: txTagsToRows(tx.id, tx.tags),
      });
    }
  });
};

const txToRow = ({
  tx,
  content_type,
  data_size,
}: {
  tx: TransactionHeader;
  content_type: string | null;
  data_size: number;
}) => {
  return pick(
    {
      ...tx,
      content_type,
      format: tx.format || 1,
      data_size:
        tx.data_size ||
        ((tx as any).data
          ? fromB64Url((tx as any).data).byteLength
          : undefined),
      tags: JSON.stringify(tx.tags),
      owner_address: sha256B64Url(fromB64Url(tx.owner)),
    },
    txFields
  );
};

const txTagsToRows = (tx_id: string, tags: Tag[]) => {
  return tags.map((tag, index) => {
    const { name, value } = utf8DecodeTag(tag);
    return {
      tx_id,
      index,
      name: name,
      value: value,
    };
  });
};
