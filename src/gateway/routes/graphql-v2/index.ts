import {
  ApolloServer,
  ApolloServerExpressConfig,
  gql,
} from "apollo-server-express";
import { getConnectionPool } from "../../../database/postgres";
import { resolvers } from "./resolvers";
import { readFileSync } from "fs";

const typeDefs = gql(readFileSync(__dirname + "/schema/types.graphql", "utf8"));

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
