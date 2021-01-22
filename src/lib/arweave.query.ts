import { get } from 'superagent';
import { Base64UrlEncodedString, WinstonString, fromB64Url } from "./encoding";

export const NODES = process.env.ARWEAVE_NODES ? JSON.parse(process.env.ARWEAVE_NODES) : ['http://lon-1.eu-west-1.arweave.net:1984'];

export function GrabNode() {
    return NODES[Math.floor(Math.random() * NODES.length)];
}

export interface Tag {
    name: Base64UrlEncodedString;
    value: Base64UrlEncodedString;
}

export interface TransactionType {
    format: number;
    id: string;
    last_tx: string;
    owner: string;
    tags: Array<Tag>;
    target: string;
    quantity: WinstonString;
    data: Base64UrlEncodedString;
    data_size: string;
    data_tree: Array<string>;
    data_root: string;
    reward: string;
    signature: string;
}

export async function Transaction(id: string): Promise<TransactionType> {
    const payload = await get(`${GrabNode()}/tx/${id}`);
    const body = JSON.parse(payload.text);

    return {
        format: body.format,
        id: body.id,
        last_tx: body.last_tx,
        owner: body.owner,
        tags: body.tags,
        target: body.target,
        quantity: body.quantity,
        data: body.data,
        data_size: body.data_size,
        data_tree: body.data_tree,
        data_root: body.data_root,
        reward: body.reward,
        signature: body.signature,
    }
}

export function TagValue(tags: Array<Tag>, name: string): string {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (fromB64Url(tag.name).toString().toLowerCase() === name.toLowerCase()) {
            return fromB64Url(tag.value).toString();
        }
    }

    return '';
}