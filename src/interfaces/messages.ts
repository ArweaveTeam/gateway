import { TransactionHeader, Block } from "../lib/arweave";
export interface ImportTx {
  content_type: string | null;
  data_size: number;
  tx: TransactionHeader;
}

export interface ImportBlock {
  source: string;
  block: Block;
}
