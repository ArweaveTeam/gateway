import { upsert } from "./postgres";
import knex from "knex";
import { TransactionHeader, getTagValue, Tag } from "../lib/arweave";
import { fromB64Url } from "../lib/encoding";
import { pick } from "lodash";

const txFields = [
  "format",
  "id",
  "signature",
  "owner",
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

export const hasTx = async (connection: knex, id: string): Promise<boolean> => {
  const result = await connection
    .first("id")
    .from("transactions")
    .where({ id });

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
      data_size,
      tags: JSON.stringify(tx.tags),
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

const utf8DecodeTag = (
  tag: Tag
): { name: string | null; value: string | null } => {
  let name = null;
  let value = null;
  try {
    name = fromB64Url(tag.name).toString("utf8");
    value = fromB64Url(tag.value).toString("utf8");
  } catch (error) {}
  return {
    name,
    value,
  };
};
