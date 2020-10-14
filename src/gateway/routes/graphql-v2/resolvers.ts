import { TransactionHeader, utf8DecodeTag } from "../../../lib/arweave";
import { IResolvers } from "apollo-server-express";
import { query } from "../../../database/transaction-db";
import moment from "moment";
import {
  ISO8601DateTimeString,
  winstonToAr,
  sha256,
} from "../../../lib/encoding";
import { BadRequest } from "http-errors";
import graphqlFields from "graphql-fields";
import { QueryTransactionsArgs } from "./schema/types";
import { queryBlocks } from "../../../database/block-db";

type Resolvers = IResolvers;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const fieldMap = {
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
};

export const resolvers: Resolvers = {
  Query: {
    transaction: async (parent, queryParams, { req, connection }) => {
      req.log.info("[grqphql/v2] transaction/request", queryParams);
      const sqlQuery = query(connection, {
        id: queryParams.id,
        blocks: true,
        select: fieldMap,
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

      const runQuery = async () => {
        const sqlQuery = query(connection, {
          // Add one to the limit, we'll remove this result but it tells
          // us if there's another page of data to fetch.
          limit: pageSize + 1,
          offset: offset,
          ids: queryParams.ids || undefined,
          to: queryParams.recipients || undefined,
          from: queryParams.owners || undefined,
          tags: queryParams.tags || undefined,
          blocks: true,
          since: timestamp,
          select: fieldMap,
          minHeight: queryParams.block?.min || undefined,
          maxHeight: queryParams.block?.max || undefined,
          sortOrder: queryParams.sort || undefined,
        });

        console.log(sqlQuery.toSQL());

        return (await sqlQuery) as TransactionHeader[];
      };

      const results = await runQuery();

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
              node: result,
            };
          });
        },
      };
    },
    block: async (parent, queryParams, { req, connection }) => {
      req.log.info("[grqphql/v2] transaction/request", queryParams);
      const sqlQuery = queryBlocks(connection, {
        id: queryParams.id,
      }).first();

      return (await sqlQuery) as any;
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
    block: (parent) => {
      if (parent.block_id) {
        return {
          id: parent.block_id,
          previous: parent.block_previous,
          timestamp: moment(parent.block_timestamp).unix(),
          height: parent.block_height,
        };
      }
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
