import { Transaction, TransactionHeader } from "../lib/arweave";
export interface TxEvent {
  event: "gossip" | "confirmed";
  data_size: number;
  block?: {
    id: string;
    height: number;
    timestamp: number;
  };
  tx: TransactionHeader;
}
