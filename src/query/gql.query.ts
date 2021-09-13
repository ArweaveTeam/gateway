import {post} from 'superagent';
import {Tag} from './transaction.query';

export interface GQLTransaction {
    id: string;
    anchor: string;
    signature: string;
    recipient: string;
    owner: {
        address: string;
        key: string;
    };
    fee: {
        winston: string;
        ar: string;
    };
    quantity: {
        winston: string;
        ar: string;
    };
    data: {
        size: string;
        type: string;
    };
    tags: Array<Tag>;
    bundledIn: {
        id: string;
    }
}

export async function retrieveTransaction(id: string): Promise<GQLTransaction> {
  const payload = await post('https://arweave.net/graphql')
      .send({
        query: `query {
                transaction(id: "${id}") {
                        id
                    anchor
                    signature
                    recipient
                    owner {
                        address
                        key
                    }
                    fee {
                        winston
                        ar
                    }
                    quantity {
                        winston
                        ar
                    }
                    data {
                        size
                        type
                    }
                    tags {
                        name
                        value
                    }
                    block {
                        id
                        timestamp
                        height
                        previous
                    }
                    bundledIn {
                        id
                    }
                }
            }`,
      });

  return payload.body.data.transaction as GQLTransaction;
}
