import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { createConnectionPool, upsert } from "../lib/postgres";
import { TxEvent } from "../interfaces/messages";
import knex from "knex";
import { pick, defaults, find } from "lodash";
import { fromB64Url } from "../lib/encoding";
import { Transaction, Tag, TransactionHeader } from "../lib/arweave";

let pool: knex;
export const handler = createQueueHandler<TxEvent>(
  getQueueUrl("tx-index"),
  async ({ tx }) => {
    console.log(`message:`, tx);
    console.log(`indexing: ${tx.id}`);

    await pool.transaction(async (knexTransaction) => {
      try {
        await Promise.all([
          upsert(knexTransaction, {
            table: "transactions",
            conflictKeys: ["id"],
            rows: [txToRow(tx)],
          }),

          upsert(knexTransaction, {
            table: "tags",
            conflictKeys: ["tx_id", "index"],
            rows: tagsToRows(tx.id, tx.tags),
          }),
        ]);
      } catch (error) {
        console.error(tx.id, error);
        console.log(await knexTransaction.rollback(error));
      }
    });
  },
  {
    before: async () => {
      pool = createConnectionPool("write");
    },
    after: async () => {
      await pool.destroy();
    },
  }
);

const txToRow = (tx: TransactionHeader) => {
  const fieldKeys = [
    "id",
    "signature",
    "owner",
    "target",
    "reward",
    "last_tx",
    "tags",
    "content_type",
    "quantity",
    "data_size",
    "data_root",
    "data_tree",
  ];
  return pick(
    {
      ...tx,
      tags: { tags: tx.tags || { tags: [] } },
      data_tree: { data_tree: tx.data_tree || [] },
      data_root: tx.data_root || "",
      data_size: tx.data_size || 0,
      content_type: getContentType(tx),
    },
    fieldKeys
  );
};

const tagsToRows = (txid: string, tags: Tag[]) => {
  return tags
    .map((tag, index) => {
      try {
        return {
          tx: txid,
          index,
          name: fromB64Url(tag.name).toString(),
          value: fromB64Url(tag.value).toString(),
        };
      } catch (error) {
        console.error(error);
        return {
          tx: txid,
          index,
          name: "",
          value: "",
        };
      }
    })
    .filter((row) => row.name && row.value);
};

const getContentType = (tx: Omit<Transaction, "data">): string | null => {
  const contentTypeTag = find(tx.tags, (tag) => {
    try {
      return fromB64Url(tag.name).toString().toLowerCase() == "content-type";
    } catch (error) {
      return false;
    }
  });
  if (contentTypeTag) {
    try {
      return contentTypeTag
        ? fromB64Url(contentTypeTag.value).toString()
        : null;
    } catch (error) {
      return null;
    }
  }

  return null;
};
