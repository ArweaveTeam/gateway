import { upsert } from "./postgres";
import knex from "knex";
import {
  TransactionHeader,
  getTagValue,
  Tag,
  utf8DecodeTag,
  DataBundleItem,
} from "../lib/arweave";
import {
  fromB64Url,
  sha256B64Url,
  ISO8601DateTimeString,
} from "../lib/encoding";
import { pick } from "lodash";

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
  "data_root",
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
  ids?: string[];
  tags?: { name: string; values: string[] }[];
  limit?: number;
  offset?: number;
  select?: any;
  blocks?: boolean;
  since?: ISO8601DateTimeString;
  sort?: boolean;
  status?: "any" | "confirmed" | "pending";
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
    ids,
    status,
    select,
    since,
    blocks = false,
    sort = true,
  }: TxQuery
): knex.QueryBuilder => {
  const query = connection
    .queryBuilder()
    .select(select || ["id", "height", "transactions.tags"])
    .from("transactions");

  if (blocks) {
    query.leftJoin("blocks", "transactions.height", "blocks.height");
  }

  query.whereNull("transactions.deleted_at");

  if (to) {
    query.whereIn("transactions.target", to);
  }

  if (status == "confirmed") {
    query.whereNotNull("transactions.height");
  }

  if (since) {
    query.where("transactions.created_at", "<", since);
  }

  if (id) {
    query.where("transactions.id", id);
  }

  if (ids) {
    query.whereIn("transactions.id", ids);
  }

  if (from) {
    query.whereIn("transactions.owner_address", from);
  }

  if (tags) {
    tags.forEach((tag) => {
      query.whereIn("transactions.id", (query) => {
        query.select("tx_id").from("tags");
        query.where({
          "tags.name": tag.name,
        });

        query.whereIn("tags.value", tag.values);
      });
    });
  }

  query.limit(limit).offset(offset);

  if (sort) {
    query.orderByRaw("transactions.height desc NULLS first");
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
    await upsert(knexTransaction, {
      table: "transactions",
      conflictKeys: ["id"],
      rows: [
        txToRow({
          tx,
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

export const saveBundleDataItem = async (
  connection: knex,
  tx: DataBundleItem,
  { parent }: { parent: string }
) => {
  return await connection.transaction(async (knexTransaction) => {
    await upsert(knexTransaction, {
      table: "transactions",
      conflictKeys: ["id"],
      rows: [
        {
          parent,
          format: 1,
          id: tx.id,
          signature: tx.signature,
          owner: tx.owner,
          target: tx.target,
          reward: 0,
          last_tx: tx.nonce,
          tags: tx.tags,
          quantity: 0,
          data_size: fromB64Url((tx as any).data).byteLength,
        },
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

const txToRow = ({ tx }: { tx: TransactionHeader | DataBundleItem }) => {
  return pick(
    {
      ...tx,
      content_type: getTagValue(tx.tags, "content-type"),
      format: (tx as any).format || 0,
      data_size:
        (tx as any).data_size ||
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
