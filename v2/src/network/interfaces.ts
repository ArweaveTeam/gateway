import { Base64UrlEncodedString, WinstonString } from "../lib/encoding";

export type TransactionHeader = Omit<Transaction, "data">;

export type TransactionData = {
  data: Buffer;
  contentType: string | undefined;
};

export interface Transaction {
  format: number;
  id: string;
  signature: string;
  owner: string;
  target: string;
  data: Base64UrlEncodedString;
  reward: WinstonString;
  last_tx: string;
  tags: Tag[];
  quantity: WinstonString;
  data_size: number;
  data_root: string;
  data_tree: string[];
}

export interface DataBundleWrapper {
  items: DataBundleItem[];
}

export interface DataBundleItem {
  owner: string;
  target: string;
  nonce: string;
  tags: Tag[];
  data: Base64UrlEncodedString;
  signature: string;
  id: string;
}

export interface Chunk {
  data_root: string;
  data_size: number;
  data_path: string;
  chunk: string;
  offset: number;
}

export type ChunkHeader = Omit<Chunk, "chunk">;

export interface Tag {
  name: Base64UrlEncodedString;
  value: Base64UrlEncodedString;
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
