import { existsSync, WriteStream, createWriteStream } from 'fs';

export const indices = JSON.parse(process.env.INDICES || '[]') as Array<string>;
export const blockOrder = ["id", "previous_block", "mined_at", "height", "txs", "extended"];
export const transactionOrder = ["format", "id", "signature", "owner", "owner_address", "target", "reward", "last_tx", "height", "tags", "quantity", "content_type", "data_size", "data_root"];
export const tagOrder = ["tx_id", "index", "name", "value"];

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

export const streams: CSVStreams = {
    block: {
        snapshot: new WriteStream(),
        cache: new WriteStream(),
    },
    transaction: {
        snapshot: new WriteStream(),
        cache: new WriteStream(),
    },
    tags: {
        snapshot: new WriteStream(),
        cache: new WriteStream(),
    },
    rescan: {
        snapshot: new WriteStream(),
        cache: new WriteStream(),
    },
}

export function initStreams() {
    let appendHeaders = {
        block: false,
        transaction: false,
        tags: false,
    }

    if (!existsSync(`snapshot/block.csv`)) {
        appendHeaders.block = true;
    }

    if (!existsSync(`snapshot/transaction.csv`)) {
        appendHeaders.transaction = true;
    }

    if (!existsSync(`snapshot/tags.csv`)) {
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
        streams.block.snapshot.write(blockOrder.join(`|`));
    }
    
    streams.block.cache.write(blockOrder.join(`|`));

    if (appendHeaders.transaction) {
        streams.transaction.snapshot.write(transactionOrder.concat(indices).join(`|`));
    }

    streams.transaction.cache.write(transactionOrder.concat(indices).join(`|`));

    if (appendHeaders.tags) {
        streams.tags.snapshot.write(tagOrder.join(`|`));
    }
    
    streams.tags.cache.write(tagOrder.join(`|`));
}

export function resetCacheStreams() {
    streams.block.cache = createWriteStream('cache/block.csv');
    streams.transaction.cache = createWriteStream('cache/transaction.csv');
    streams.tags.cache = createWriteStream('cache/tags.csv');

    streams.block.cache.write(blockOrder.join(`|`));
    streams.transaction.snapshot.write(transactionOrder.concat(indices).join(`|`));
    streams.tags.cache.write(tagOrder.join(`|`));
}