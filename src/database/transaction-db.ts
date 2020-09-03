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
import moment from "moment";
import { TagFilter } from "../gateway/routes/graphql-v2/schema/types";

interface DatabaseTag {
  tx_id: string;
  index: number;
  name: string | undefined;
  value: string | undefined;
  // value_numeric: string | undefined;
}

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

type TxSortOrder = "HEIGHT_ASC" | "HEIGHT_DESC";

const orderByClauses: { [key in TxSortOrder]: string } = {
  HEIGHT_ASC: "transactions.height ASC NULLS LAST, id ASC",
  HEIGHT_DESC: "transactions.height DESC NULLS FIRST, id ASC",
};

interface TxQuery {
  to?: string[];
  from?: string[];
  id?: string;
  ids?: string[];
  tags?: TagFilter[];
  limit?: number;
  offset?: number;
  select?: any;
  blocks?: boolean;
  since?: ISO8601DateTimeString;
  sortOrder?: TxSortOrder;
  status?: "any" | "confirmed" | "pending";
  pendingMinutes?: number;
  minHeight?: number;
  maxHeight?: number;
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
    sortOrder = "HEIGHT_DESC",
    pendingMinutes = 60,
    minHeight = -1,
    maxHeight = -1,
  }: TxQuery
): knex.QueryBuilder => {
  const query = connection
    .queryBuilder()
    .select(
      select || {
        id: "transactions.id",
        heihgt: "transactions.height",
        tags: "transactions.tags",
      }
    )
    .from("transactions");

  if (blocks) {
    query.leftJoin("blocks", "transactions.height", "blocks.height");
  }

  query.where((query) => {
    // Include recent pending transactions up to pendingMinutes old.
    // After this threshold they will be considered orphaned so not included in results.
    query
      .whereNotNull("transactions.height")
      .orWhere(
        "transactions.created_at",
        ">",
        moment().subtract(pendingMinutes, "minutes").toISOString()
      );
  });

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

  if (to) {
    query.whereIn("transactions.target", to);
  }

  if (from) {
    query.whereIn("transactions.owner_address", from);
  }

  if (tags) {
    tags.forEach((tag, index) => {
      const tagAlias = `${index}_${index}`;

      query.join(`tags as ${tagAlias}`, (join) => {
        join.on("transactions.id", `${tagAlias}.tx_id`);

        join.andOnIn(`${tagAlias}.name`, [tag.name]);

        if (tag.op == "EQ") {
          join.andOnIn(`${tagAlias}.value`, tag.values);
        }

        if (tag.op == "NEQ") {
          join.andOnNotIn(`${tagAlias}.value`, tag.values);
        }
      });
    });
  }

  if (minHeight >= 0) {
    query.where("transactions.height", ">=", minHeight);
  }

  if (maxHeight >= 0) {
    query.where("transactions.height", "<=", maxHeight);
  }

  query.limit(limit).offset(offset);

  if (Object.keys(orderByClauses).includes(sortOrder)) {
    query.orderByRaw(orderByClauses[sortOrder]);
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
          owner_address: sha256B64Url(fromB64Url(tx.owner)),
          target: tx.target,
          reward: 0,
          last_tx: tx.nonce,
          tags: JSON.stringify(tx.tags),
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

const txTagsToRows = (tx_id: string, tags: Tag[]): DatabaseTag[] => {
  return tags.map((tag, index) => {
    const { name, value } = utf8DecodeTag(tag);
    return {
      tx_id,
      index,
      name,
      value,
      // value_numeric:
      //   value && value.match(/^-?\d{1,20}$/) == null ? undefined : value,
      // For now we're just filtering for numeric looking values, as JS ints
      // and postgres ints have different max safe values we don't want to parse it in JS
      // This needs more work in future to align the two.
    };
  });
};
