import { Base64UrlEncodedString, fromB64Url } from "./encoding";
export interface Tag {
  name: Base64UrlEncodedString;
  value: Base64UrlEncodedString;
}
export interface Transaction {
  format: number;
  id: string;
  signature: string;
  owner: string;
  target: string;
  data: Base64UrlEncodedString;
  reward: string;
  last_tx: string;
  tags: Tag[];
  quantity: string;
  data_size: number;
  data_root: string;
  data_tree: string[];
}

export interface Block {
  nonce: string;
  previous_block: string;
  timestamp: number;
  last_retarget: number;
  diff: string;
  height: number;
  hash: string;
  indep_hash: string;
  txs: string[];
  tx_root: string;
  wallet_list: string;
  reward_addr: string;
  reward_pool: number;
  weave_size: number;
  block_size: number;
  cumulative_diff: string;
  hash_list_merkle: string;
}

export type TransactionHeader = Omit<Transaction, "data">;

export const getTagValue = (
  tx: TransactionHeader | Transaction,
  name: string
): string | undefined => {
  const contentTypeTag = tx.tags.find((tag) => {
    try {
      return (
        fromB64Url(tag.name).toString().toLowerCase() == name.toLowerCase()
      );
    } catch (error) {
      return false;
    }
  });
  try {
    return contentTypeTag
      ? fromB64Url(contentTypeTag.value).toString()
      : undefined;
  } catch (error) {
    return undefined;
  }
};
