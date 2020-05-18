import { TransactionHeader, utf8DecodeTag } from "../../lib/arweave";
import { IResolvers } from "apollo-server-lambda";
import graphqlFields from "graphql-fields";
import { query } from "../../database/transaction-db";

export const resolvers: IResolvers | Array<IResolvers> = {
  Query: {
    transaction: (
      root: any,
      { id, to, from, tags }: any,
      context: any,
      info: any
    ) => {
      return query(context.connection, {
        id,
      });
    },
    transactions: async (root, { to, from, tags }, context, info) => {
      const fields = graphqlFields(info as any);

      console.log("root", root);

      const sqlQuery = query(context.connection, {
        limit: 10,
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
      root,
      { byForeignTag, to, from, tags },
      context,
      info
    ) => {
      const sqlQuery = query(context.connection, {
        limit: 1000,
        to,
        from,
        tags: ((tags as any[]) || []).concat({
          name: byForeignTag,
          value: root.id,
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
      root,
      { byForeignTag, to, from, tags },
      context,
      info
    ) => {
      const sqlQuery = query(context.connection, {
        limit: 1000,
        to,
        from,
        tags: ((tags as any[]) || []).concat({
          name: byForeignTag,
          value: root.id,
        }),
        select: [],
        sort: false,
      }).count();

      // console.log(sqlQuery.toSQL());

      return (await sqlQuery.first()).count;
    },
  },
};
