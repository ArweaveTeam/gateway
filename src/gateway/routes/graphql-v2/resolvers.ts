import { TransactionHeader, utf8DecodeTag } from "../../../lib/arweave";
import { IResolvers } from "apollo-server-express";
import { query } from "../../../database/transaction-db";
import moment from "moment";
import { ISO8601DateTimeString, winstonToAr } from "../../../lib/encoding";
import { BadRequest } from "http-errors";
import graphqlFields from "graphql-fields";
import { QueryTransactionsArgs } from "./schema/types";
import { DatabaseBlock, queryBlocks } from "../../../database/block-db";

type Resolvers = IResolvers;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const txFieldMap = {
  id: "transactions.id",
  anchor: "transactions.last_tx",
  recipient: "transactions.target",
  tags: "transactions.tags",
  fee: "transactions.reward",
  quantity: "transactions.quantity",
  data_size: "transactions.data_size",
  data_type: "transactions.content_type",
  parent: "transactions.parent",
  owner: "transactions.owner",
  owner_address: "transactions.owner_address",
  signature: "transactions.signature",
  block_id: "blocks.id",
  block_timestamp: "blocks.mined_at",
  block_height: "blocks.height",
  block_previous: "blocks.previous_block",
  block_extended: "blocks.extended",
};

const blockFieldMap = {
  id: "blocks.id",
  timestamp: "blocks.mined_at",
  height: "blocks.height",
  previous: "blocks.previous_block",
  extended: "blocks.extended",
};

export const resolvers: Resolvers = {
  Query: {
    transaction: async (parent, queryParams, { req, connection }) => {
      req.log.info("[grqphql/v2] transaction/request", queryParams);
      const sqlQuery = query(connection, {
        id: queryParams.id,
        blocks: true,
        select: txFieldMap,
      }).first();

      return (await sqlQuery) as TransactionHeader;
    },
    transactions: async (
      parent,
      queryParams: QueryTransactionsArgs,
      { req, connection },
      info
    ) => {
      req.log.info("[grqphql/v2] transactions/request", {
        queryParams,
        fields: graphqlFields(info as any),
      });

      const { timestamp, offset } = parseCursor(
        queryParams.after || newCursor()
      );

      const pageSize = Math.min(
        queryParams.first || DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

      const sqlQuery = query(connection, {
        // Add one to the limit, we'll remove this result but it tells
        // us if there's another page of data to fetch.
        limit: pageSize + 1,
        offset: offset,
        ids: queryParams.ids || undefined,
        to: queryParams.recipients || undefined,
        from: queryParams.owners || undefined,
        tags: queryParams.tags || undefined,
        parents: queryParams.bundledIn || undefined,
        blocks: true,
        before: timestamp,
        select: txFieldMap,
        minHeight: queryParams.block?.min || undefined,
        maxHeight: queryParams.block?.max || undefined,
        sortOrder: queryParams.sort || undefined,
      });

      req.log.info(sqlQuery.toSQL());

      const results = (await sqlQuery) as TransactionHeader[];

      req.log.info("[grqphql/v2] transactions/response", {
        queryParams,
        results: results.length,
        pageSize,
        offset,
      });

      const hasNextPage = results.length > pageSize;

      return {
        pageInfo: {
          hasNextPage,
        },
        edges: async () => {
          return results.slice(0, pageSize).map((result: any, index) => {
            return {
              cursor: encodeCursor({ timestamp, offset: offset + index + 1 }),
              node: {
                ...result,
                block: result?.block_id
                  ? {
                      id: result?.block_id,
                      timestamp: result?.block_timestamp,
                      height: result?.block_height,
                      previous: result?.block_previous,
                      extended: result?.block_extended,
                    }
                  : null,
              },
            };
          });
        },
      };
    },
    block: async (parent, queryParams, { req, connection }) => {
      req.log.info("[grqphql/v2] transaction/request", queryParams);
      const sqlQuery = queryBlocks(connection, {
        select: blockFieldMap,
        id: queryParams.id,
      }).first();

      return (await sqlQuery) as any;
    },
    blocks: async (parent, queryParams, { req, connection }) => {
      req.log.info("[grqphql/v2] blocks/request", queryParams);

      const { timestamp, offset } = parseCursor(
        queryParams.after || newCursor()
      );

      const pageSize = Math.min(
        queryParams.first || DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

      const sqlQuery = queryBlocks(connection, {
        ids: queryParams.ids,
        select: blockFieldMap,
        minHeight: queryParams.height?.min,
        maxHeight: queryParams.height?.max,
        sortOrder: queryParams.sort,
        // +1 so we know if there is another page of results,
        // this last result can be array.sliced off the response.
        limit: pageSize + 1,
        offset: offset,
        before: timestamp,
      });

      req.log.info(sqlQuery.toSQL());

      const results = (await sqlQuery) as DatabaseBlock[];

      req.log.info("[grqphql/v2] blocks/response", {
        queryParams,
        results: results.length,
        pageSize,
        offset,
      });

      const hasNextPage = results.length > pageSize;

      return {
        pageInfo: {
          hasNextPage,
        },
        edges: async () => {
          return results.slice(0, pageSize).map((result: any, index) => {
            return {
              cursor: encodeCursor({ timestamp, offset: offset + index + 1 }),
              node: result,
            };
          });
        },
      };
    },
  },
  Transaction: {
    tags: (parent) => {
      return parent.tags.map(utf8DecodeTag);
    },
    recipient: (parent) => {
      return parent.recipient.trim();
    },
    data: (parent) => {
      return {
        size: parent.data_size || 0,
        type: parent.data_type,
      };
    },
    quantity: (parent) => {
      return {
        ar: winstonToAr(parent.quantity || 0),
        winston: parent.quantity || 0,
      };
    },
    fee: (parent) => {
      return {
        ar: winstonToAr(parent.fee || 0),
        winston: parent.fee || 0,
      };
    },
    owner: (parent) => {
      return {
        address: parent.owner_address,
        key: parent.owner,
      };
    },
    parent: (parent) => {
      if (parent.parent) {
        return {
          id: parent.parent,
        };
      }
    },
    bundledIn: (parent) => {
      if (parent.parent) {
        return {
          id: parent.parent,
        };
      }
    },
  },
  Block: {
    // Not fully supported for old blocks yet
    // reward: (parent) => {
    //   return {
    //     address: parent.extended.reward_addr,
    //     pool: parent.extended.reward_pool,
    //   };
    // },
    // size: (parent) => {
    //   return parent.extended?.block_size;
    // },
    timestamp: (parent) => {
      return moment(parent?.timestamp).unix();
    },
  },
};

const newCursor = (): string => {
  return encodeCursor({ timestamp: moment().toISOString(), offset: 0 });
};

const encodeCursor = ({
  timestamp,
  offset,
}: {
  timestamp: ISO8601DateTimeString;
  offset: number;
}): string => {
  const string = JSON.stringify([timestamp, offset]);
  return Buffer.from(string).toString("base64");
};

const parseCursor = (
  cursor: string
): { timestamp: ISO8601DateTimeString; offset: number } => {
  try {
    const [timestamp, offset] = JSON.parse(
      Buffer.from(cursor, "base64").toString()
    ) as [ISO8601DateTimeString, number];

    return { timestamp, offset };
  } catch (error) {
    console.error(error);
    throw new BadRequest("invalid cursor");
  }
};
