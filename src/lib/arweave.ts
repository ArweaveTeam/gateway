import { Base64UrlEncodedString, fromB64Url } from "./encoding";

export const getTagValue = (
  tx: Transaction,
  name: string
): string | undefined => {
  const tag = tx.tags.find(
    item =>
      fromB64Url(item.name)
        .toString()
        .toLowerCase() == name.toLowerCase()
  );
  return tag ? fromB64Url(tag.value).toString() : undefined;
};

export interface Transaction {
  id: Base64UrlEncodedString;
  signature: Base64UrlEncodedString;
  owner: Base64UrlEncodedString;
  target: Base64UrlEncodedString;
  data: Base64UrlEncodedString;
  reward: string;
  last_tx: Base64UrlEncodedString;
  tags: { name: Base64UrlEncodedString; value: Base64UrlEncodedString }[];
  quantity: string;
}
