import {config} from 'dotenv';
config();

export const blockOrder = ['id', 'previous_block', 'mined_at', 'height', 'txs', 'extended'];
export const transactionOrder = ['format', 'id', 'signature', 'owner', 'owner_address', 'target', 'reward', 'last_tx', 'height', 'tags', 'quantity', 'content_type', 'data_size', 'data_root'];
export const tagOrder = ['tx_id', 'index', 'name', 'value'];
