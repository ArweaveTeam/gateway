import { TransactionHeader, Block, ChunkHeader } from '../lib/arweave'

export type DataFormatVersion = 1.0 | 2.0 | 2.1;

export interface DispatchTx {
  tx: TransactionHeader;
  data_size: number;
  data_format: DataFormatVersion;
}

export interface ImportChunk {
  header: ChunkHeader;
  size: number;
}

export interface ExportChunk {
  header: ChunkHeader;
  size: number;
}

export interface ImportTx {
  id?: string;
  tx?: TransactionHeader;
}

export interface ImportBlock {
  source: string;
  block: Block;
}

export interface ImportBundle {
  id?: string;
  header?: TransactionHeader;
}
