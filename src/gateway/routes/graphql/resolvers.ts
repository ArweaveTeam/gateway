import { TransactionHeader, utf8DecodeTag, Tag } from "../../../lib/arweave";
import { query } from "../../../database/transaction-db";
import { IResolvers } from "apollo-server-express";

type Resolvers = IResolvers;

type ResolverFn = (parent: any, args: any, ctx: any) => Promise<any>;
interface ResolverMap {
  [field: string]: ResolverFn;
}

export const defaultMaxResults = 5000;

export const resolvers: Resolvers = {
  Query: {
    transaction: async (parent, { id }, context) => {
      return query(context.connection, {
        id,
      });
    },
    transactions: async (parent, { to, from, tags }, context) => {
      const sqlQuery = query(context.connection, {
        limit: defaultMaxResults,
        to,
        from,
        tags: (tags || []).map((tag: Tag) => {
          return {
            name: tag.name,
            values: [tag.value],
          };
        }),
      });

      // console.log(sqlQuery.toSQL());

      const results = (await sqlQuery) as TransactionHeader[];

      return results.map(({ id, tags = [] }: Partial<TransactionHeader>) => {
        return {
          id,
          tags: tags.map(utf8DecodeTag),
        };
      });
    },
  },
  Transaction: {
    linkedFromTransactions: async (
      parent,
      { byForeignTag, to, from, tags },
      context
    ) => {
      const sqlQuery = query(context.connection, {
        limit: defaultMaxResults,
        to,
        from,
        tags: ((tags as any[]) || []).concat({
          name: byForeignTag,
          values: [parent.id],
        }),
      });

      // console.log(sqlQuery.toSQL());

      const results = (await sqlQuery) as TransactionHeader[];

      return results.map(({ id, tags = [] }: Partial<TransactionHeader>) => {
        return {
          id,
          tags: tags.map(utf8DecodeTag),
        };
      });
    },
    countLinkedFromTransactions: async (
      parent,
      { byForeignTag, to, from, tags },
      context
    ) => {
      const sqlQuery = query(context.connection, {
        limit: defaultMaxResults,
        to,
        from,
        tags: ((tags as any[]) || []).concat({
          name: byForeignTag,
          values: [parent.id],
        }),
        select: [],
        sort: false,
      }).count();

      // console.log(sqlQuery.toSQL());

      return (await sqlQuery.first()).count;
    },
  },
};
