import { ApolloServer } from "apollo-server-lambda";
import { APIGatewayEvent, Context as LambdaContext } from "aws-lambda";
import { getConnectionPool } from "../../database/postgres";
import { createRouter, APIHandler } from "../../lib/api-handler";
import { resolvers } from "./resolvers";
import { typeDefs } from "./schema";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: {
    connection: getConnectionPool("read"),
  },
});

const apolloHandler = server.createHandler({});

const router = createRouter();

export const graphqlHandler: APIHandler = async (request, response) => {
  return new Promise((resolve, reject) => {
    apolloHandler(
      {
        //@ts-ignore
        ...request.app._event,
        body: JSON.stringify(request.body),
      },
      request.context,
      (error, result) => {
        if (error) {
          reject(error);
        }

        if (result) {
          if (result.statusCode) {
            response.status(result.statusCode);
          }

          if (result.headers) {
            Object.keys(result.headers).forEach((header) => {
              const value = result.headers![header];
              response.header(header, "" + value || "");
            });
            resolve(result.body);
          }
        }
        reject();
      }
    );
  });
};

router.any(graphqlHandler);

export const handler = async (
  event: APIGatewayEvent,
  context: LambdaContext,
  callback: (err: Error, result: any) => void
) => {
  return router.run(event, context, callback);
};
