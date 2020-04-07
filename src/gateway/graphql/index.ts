// // import graphiql from "graphql-playground-middleware-express";
// // import { ApolloServer, gql } from "apollo-server-express";
// import { app, start } from "../app";

// const typeDefs = gql`
//   type TagInput {
//     name: String!
//     value: String!
//   }

//   type Query {
//     hello: String
//     transaction: Transaction!
//     transactions(from: [String!], to: [String!]): [Transaction!]
//   }

//   type Transaction {
//     id: ID!
//   }

//   type Transactions {
//     from: [String!]
//     tags: [TagInput!]
//     to: [String!]
//   }
// `;

// const resolvers = {
//   Query: {
//     hello: (a: any, b: any) => {
//       console.log("graphql!", a, b);
//       return "uh?";
//     },
//     transactions: (a: any, b: any) => {
//       console.log("graphql!", a, b);
//       return "uh?";
//     }
//   }
// };

// const server = new ApolloServer({
//   typeDefs,
//   resolvers
// });

// app.get("/playground", graphiql({ endpoint: "/graphql" }));

// server.applyMiddleware({ app, path: "/graphql" });

// export const handler = start();
