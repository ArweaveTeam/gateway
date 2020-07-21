import { gql } from "apollo-server-express";
import Arweave from "arweave/node";

export const typeDefs = gql`
  type Query {
    """
    Get a transaction by id
    """
    transaction(id: ID!): Transaction

    """
    Get a set of transactions using filters
    """
    transactions(
      """
      Filter transactions by a list of ids
      """
      id: [ID]
      """
      Filter transactions by a list of target wallet addresses
      """
      to: [String]
      """
      Filter transactions by a list of owner public keys or wallet addresses
      """
      from: [String]
      """
      Filter transactions by tag values
      """
      tags: [TagInput]
      """
      Filter by transactions by status, defaults to \`[PENDING, CONFIRMED]\`
      """
      status: [Status]

      """
      Limit results set to the first n results
      """
      first: Int

      """
      Get pass a cursor value from an edge node to move through the paginated result set
      """
      after: String
    ): TransactionConnection!
  }

  """
  Match transactions with the given tags
  """
  input TagInput {
    """
    Filter by tag name
    """
    name: String
    """
    Filter by tag value
    """
    value: String
  }

  """
  Paginated result set using the GraphQL cursor spec:
  https://relay.dev/graphql/connections.htm.
  """
  type TransactionConnection {
    pageInfo: PageInfo!
    edges: [TransactionEdge!]
  }

  """
  Paginated result using the GraphQL cursor spec:
  https://relay.dev/graphql/connections.htm.
  """
  type TransactionEdge {
    """
    A cursor value for fetching the next page
    """
    cursor: String!
    """
    A result transaction object
    """
    node: Transaction!
  }

  """
  Paginated page info using the GraphQL cursor spec:
  https://relay.dev/graphql/connections.htm.
  """
  type PageInfo {
    hasNextPage: Boolean!
  }

  type Transaction {
    id: ID!

    anchor: String!
    signature: String!
    target: String!

    owner: Owner!
    fee: Amount!
    transfer: Amount!
    data: DataMeta!
    tags: [Tag]!
    block: Block
    parent: Parent
  }

  """
  The parent transaction for bundled transactions,
  see: https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-102.md.
  """
  type Parent {
    id: ID
  }

  """
  The block in which the transaction was included.
  """
  type Block {
    id: ID
    timestamp: Int!
    height: Int!
    previous: ID
  }

  """
  Metadata about a transaction data.
  """
  type DataMeta {
    """
    Size of the associated data in bytes.
    """
    size: Int!
    """
    Type is derrived from the \`content-type\` tag on a transaction.
    """
    type: String
  }
  """
  Representation of a value transfer between wallets, in both winson and ar.
  """
  type Amount {
    """
    Amount as a winston string e.g. \`"1000000000000"\`.
    """
    winston: String!
    """
    Amount as an AR string e.g. \`"0.000000000001"\`.
    """
    ar: String!
  }

  """
  Representation of a transaction owner
  """
  type Owner {
    """
    The owner's wallet address.
    """
    address: String!
    """
    The owner's public key as a base64url encoded string.
    """
    key: String!
  }

  type Tag {
    """
    Decoded tag name
    """
    name: String
    """
    Decoded tag value
    """
    value: String
  }

  """
  The operator to apply to a tag value.
  """
  enum TagOperator {
    """
    Equals
    """
    EQ
    """
    Greater than
    """
    GT
    """
    Less than
    """
    LT
  }

  """
  Transaction statuses
  """
  enum Status {
    """
    Transaction is included in a block
    """
    CONFIRMED
    """
    Transaction is not yet included in a block
    """
    PENDING
  }
`;
