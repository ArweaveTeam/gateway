import { TransactionHeader, utf8DecodeTag } from "../../../lib/arweave";
import { IResolvers } from "apollo-server-express";
import { query } from "../../../database/transaction-db";
import moment from "moment";
import { ISO8601DateTimeString, winstonToAr } from "../../../lib/encoding";
import { BadRequest } from "http-errors";

type Resolvers = IResolvers;

type ResolverFn = (parent: any, args: any, ctx: any) => Promise<any>;

export const DEFAULT_PAGE_SIZE = 3;
export const MAX_PAGE_SIZE = 5;

export const resolvers: Resolvers = {
  Query: {
    transaction: async (parent, { id }, context) => {
      return query(context.connection, {
        id,
      });
    },
    transactions: async (parent, queryParams, context) => {
      console.log("[grqphql/v2]", parent, queryParams);

      const cursor = queryParams.after;

      const { timestamp, offset } = parseCursor(
        queryParams.after || newCursor()
      );

      const pageSize = parsePageSize(queryParams.first);

      const sqlQuery = query(context.connection, {
        // Add one to the limit, we'll remove this result but it tells
        // us if there's another page of data to fetch.
        limit: pageSize + 1,
        offset: offset,
        to: queryParams.to,
        from: queryParams.from,
        tags: queryParams.tags,
        blocks: true,
        since: timestamp,
        select: {
          id: "transactions.id",
          ancho: "transactions.last_tx",
          target: "transactions.target",
          tags: "transactions.tags",
          fee: "transactions.reward",
          transfer: "transactions.quantity",
          data_size: "transactions.data_size",
          data_type: "transactions.content_type",
          parent: "transactions.parent",
          owner: "transactions.owner",
          owner_address: "transactions.owner_address",
          block_id: "blocks.id",
          block_timestamp: "blocks.mined_at",
          block_height: "blocks.height",
          block_previous: "blocks.previous_block",
        },
      });

      console.log("[grqphql/v2/cursor]", {
        cursor,
        timestamp,
        offset,
        query: sqlQuery.toSQL(),
      });

      const results = (await sqlQuery) as TransactionHeader[];

      const hasNextPage = results.length > pageSize;

      return {
        pageInfo: {
          hasNextPage,
        },
        edges: async () => {
          return results
            .slice(0, pageSize)
            .map((result: Partial<TransactionHeader>, index) => {
              return {
                cursor: encodeCursor({ timestamp, offset: offset + index }),
                node: {
                  ...result,
                  tags: result?.tags?.map(utf8DecodeTag),
                },
              };
            });
        },
      };
    },
  },
  Transaction: {
    transfer: (parent) => {
      return {
        ar: winstonToAr(parent.amount),
        winston: parent.amount,
      };
    },
    fee: (parent) => {
      return {
        ar: winstonToAr(parent.transfer),
        winston: parent.transfer,
      };
    },
    block: (parent) => {
      return {
        id: parent.block_id,
        previous: parent.block_previous,
        timestamp: parent.block_timestamp,
        height: parent.block_height,
      };
    },
    owner: (parent) => {
      return {
        address: parent.owner_address,
        key: parent.owner,
      };
    },
  },
};

const newCursor = (): { timestamp: ISO8601DateTimeString; offset: number } => {
  return { timestamp: moment().format(), offset: 0 };
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
    throw new BadRequest("invalid cursor");
  }
};

const parsePageSize = (limit: any): number => {
  return Math.min(
    limit ? parseInt(limit as string) : DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
};
