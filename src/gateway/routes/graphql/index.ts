import { ApolloServer } from "apollo-server-express";
import { getConnectionPool } from "../../../database/postgres";
import { resolvers } from "./resolvers";
import { typeDefs } from "./schema";

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  debug: false,
  context: () => {
    console.log("context...");
    return {
      connection: getConnectionPool("read"),
    };
  },
});

export { apolloServer };
