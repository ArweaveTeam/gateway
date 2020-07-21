import { ApolloServer, ApolloServerExpressConfig } from "apollo-server-express";
import { getConnectionPool } from "../../../database/postgres";
import { resolvers } from "./resolvers";
import { typeDefs } from "./schema";

const apolloServer = (opts: ApolloServerExpressConfig = {}) => {
  return new ApolloServer({
    typeDefs,
    resolvers,
    debug: false,
    context: () => {
      return {
        connection: getConnectionPool("read"),
      };
    },
    ...opts,
  });
};

export { apolloServer };
