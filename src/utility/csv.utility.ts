import {existsSync, WriteStream, createWriteStream} from 'fs';
import {indices, blockOrder, transactionOrder, tagOrder} from './order.utility';
import {mkdir} from './file.utility';

export interface CSVStreams {
    block: {
        snapshot: WriteStream;
        cache: WriteStream;
    };

    transaction: {
        snapshot: WriteStream;
        cache: WriteStream;
    };

    tags: {
        snapshot: WriteStream;
        cache: WriteStream;
    };

    rescan: {
        snapshot: WriteStream;
        cache: WriteStream;
    };
}

mkdir('snapshot');
mkdir('cache');

export const streams: CSVStreams = {
  block: {
    snapshot: createWriteStream('snapshot/block.csv', {flags: 'a'}),
    cache: createWriteStream('cache/block.csv'),
  },
  transaction: {
    snapshot: createWriteStream('snapshot/transaction.csv', {flags: 'a'}),
    cache: createWriteStream('cache/transaction.csv'),
  },
  tags: {
    snapshot: createWriteStream('snapshot/tags.csv', {flags: 'a'}),
    cache: createWriteStream('cache/tags.csv'),
  },
  rescan: {
    snapshot: createWriteStream('snapshot/.rescan', {flags: 'a'}),
    cache: createWriteStream('cache/.rescan', {flags: 'a'}),
  },
};

export function initStreams() {
  const appendHeaders = {
    block: false,
    transaction: false,
    tags: false,
  };

  if (!existsSync('snapshot/block.csv')) {
    appendHeaders.block = true;
  }

  if (!existsSync('snapshot/transaction.csv')) {
    appendHeaders.transaction = true;
  }

  if (!existsSync('snapshot/tags.csv')) {
    appendHeaders.tags = true;
  }

  streams.block = {
    snapshot: createWriteStream('snapshot/block.csv', {flags: 'a'}),
    cache: createWriteStream('cache/block.csv'),
  };

  streams.transaction = {
    snapshot: createWriteStream('snapshot/transaction.csv', {flags: 'a'}),
    cache: createWriteStream('cache/transaction.csv'),
  };

  streams.tags = {
    snapshot: createWriteStream('snapshot/tags.csv', {flags: 'a'}),
    cache: createWriteStream('cache/tags.csv'),
  };

  streams.rescan = {
    snapshot: createWriteStream('snapshot/.rescan', {flags: 'a'}),
    cache: createWriteStream('cache/.rescan', {flags: 'a'}),
  };

  if (appendHeaders.block) {
    streams.block.snapshot.write(blockOrder.join('|') + '\n');
  }

  streams.block.cache.write(blockOrder.join('|') + '\n');

  if (appendHeaders.transaction) {
    streams.transaction.snapshot.write(transactionOrder.concat(indices).join('|') + '\n');
  }

  streams.transaction.cache.write(transactionOrder.concat(indices).join('|') + '\n');

  if (appendHeaders.tags) {
    streams.tags.snapshot.write(tagOrder.join('|') + '\n');
  }

  streams.tags.cache.write(tagOrder.join('|') + '\n');
}

export function resetCacheStreams() {
  streams.block.cache = createWriteStream('cache/block.csv');
  streams.transaction.cache = createWriteStream('cache/transaction.csv');
  streams.tags.cache = createWriteStream('cache/tags.csv');

  streams.block.cache.write(blockOrder.join('|') + '\n');
  streams.transaction.snapshot.write(transactionOrder.concat(indices).join('|') + '\n');
  streams.tags.cache.write(tagOrder.join('|') + '\n');
}
