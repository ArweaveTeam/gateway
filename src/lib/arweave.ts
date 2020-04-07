import { Base64UrlEncodedString, fromB64Url } from "./encoding";

export const getTagValue = (
  tx: Transaction,
  name: string
): string | undefined => {
  const tag = tx.tags.find(
    (item) =>
      fromB64Url(item.name).toString().toLowerCase() == name.toLowerCase()
  );
  return tag ? fromB64Url(tag.value).toString() : undefined;
};

export interface Tag {
  name: Base64UrlEncodedString;
  value: Base64UrlEncodedString;
}
export interface Transaction {
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

export type TransactionHeader = Omit<Transaction, "data">;
