import { TransactionHeader, Block } from "../lib/arweave";

export interface DispatchTx {
  tx: TransactionHeader;
}

export interface ImportTx {
  id?: string;
  tx?: TransactionHeader;
}

export interface ImportBlock {
  source: string;
  block: Block;
}
