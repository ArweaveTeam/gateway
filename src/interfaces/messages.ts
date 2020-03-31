import { Base64UrlEncodedString } from "../lib/encoding";
export interface TxEvent {
  event: "gossip" | "confirmed";
  data_size: number;
  block?: {
    id: string;
    height: number;
    timestamp: number;
  };
  tx: {
    id: Base64UrlEncodedString;
    signature: Base64UrlEncodedString;
    owner: Base64UrlEncodedString;
    target: Base64UrlEncodedString;
    reward: string;
    last_tx: Base64UrlEncodedString;
    tags: { name: Base64UrlEncodedString; value: Base64UrlEncodedString }[];
    quantity: string;
  };
}
