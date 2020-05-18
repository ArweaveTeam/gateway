import { gql } from "apollo-server-lambda";

export const typeDefs = gql`
  type Query {
    transaction(id: ID!): Transaction
    transactions(
      from: [String!]
      to: [String!]
      tags: [TagInput!]
    ): [Transaction!]!
    countTransactions(from: [String!], to: [String!], tags: [TagInput!]): Int!
  }

  type Transaction {
    id: ID!
    tags: [Tag!]!
    tagValue(tagName: String!): String
    linkedToTransaction(byOwnTag: String!): Transaction
    linkedFromTransactions(
      byForeignTag: String!
      from: [String!]
      to: [String!]
      tags: [TagInput!]
    ): [Transaction!]!
    countLinkedFromTransactions(
      byForeignTag: String!
      from: [String!]
      to: [String!]
      tags: [TagInput!]
    ): Int!
  }

  type Tag {
    name: String!
    value: String!
  }

  input TagInput {
    name: String!
    value: String!
  }
`;
