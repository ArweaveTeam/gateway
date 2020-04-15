import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { createConnectionPool, upsert } from "../lib/postgres";
import { ImportTx } from "../interfaces/messages";
import knex from "knex";
import { pick } from "lodash";
import { fromB64Url } from "../lib/encoding";
import { Tag } from "../lib/arweave";

let pool: knex;
export const handler = createQueueHandler<ImportTx>(
  getQueueUrl("import-txs"),
  async ({ tx, content_type, data_size }) => {
    console.log(`message:`, tx);
    console.log(`indexing: ${tx.id}`);

    await pool.transaction(async (knexTransaction) => {
      try {
        await Promise.all([
          upsert(knexTransaction, {
            table: "transactions",
            conflictKeys: ["id"],
            rows: [txToRow({ tx, content_type, data_size })],
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

const txToRow = ({ tx, content_type, data_size }: ImportTx) => {
  return pick(
    {
      ...tx,
      content_type,
      data_size,
      tags: JSON.stringify(tx.tags),
    },
    [
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
    ]
  );
};

const tagsToRows = (tx_id: string, tags: Tag[]) => {
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
