import { TransactionHeader, utf8DecodeTag } from "../../../lib/arweave";
import { query } from "../../../database/transaction-db";
import { IResolvers } from "apollo-server-express";

type Resolvers = IResolvers;

type ResolverFn = (parent: any, args: any, ctx: any) => Promise<any>;
interface ResolverMap {
  [field: string]: ResolverFn;
}

export const resolvers: Resolvers = {
  Query: {
    transaction: async (parent, { id }, context) => {
      return query(context.connection, {
        id,
      });
    },
    transactions: async (parent, { to, from, tags }, context) => {
      console.log("parent", parent);

      const sqlQuery = query(context.connection, {
        limit: 100,
        to,
        from,
        tags,
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
        limit: 1000,
        to,
        from,
        tags: ((tags as any[]) || []).concat({
          name: byForeignTag,
          value: parent.id,
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
        limit: 1000,
        to,
        from,
        tags: ((tags as any[]) || []).concat({
          name: byForeignTag,
          value: parent.id,
        }),
        select: [],
        sort: false,
      }).count();

      // console.log(sqlQuery.toSQL());

      return (await sqlQuery.first()).count;
    },
  },
};
