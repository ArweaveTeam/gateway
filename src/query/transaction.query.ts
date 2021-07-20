import { get } from 'superagent';
import { TagFilter } from '../graphql/types';
import {
  Base64UrlEncodedString,
  WinstonString,
  fromB64Url,
} from '../utility/encoding.utility';
import { grabNode, coolNode, warmNode } from './node.query';

export interface Tag {
  name: Base64UrlEncodedString;
  value: Base64UrlEncodedString;
}

export interface TransactionType {
  format: number;
  id: string;
  height?: number;
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

export function transaction(
  id: string,
  retry = 0
): Promise<TransactionType | void> {
  const tryNode = grabNode();

  return get(`${tryNode}/tx/${id}`)
    .then((payload) => {
      const body = JSON.parse(payload.text);
      warmNode(tryNode);
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
      };
    })
    .catch(() => {
      return new Promise((res) => setTimeout(res, 10 + 2 * retry)).then(() => {
        if (retry < 100) {
          return transaction(id, retry + 1);
        } else {
          console.error(
            'Failed to establish connection to any specified node after 100 retries'
          );
          process.exit(1);
        }
      });
    });
}

export function toB64url(input: string): Base64UrlEncodedString {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function tagValue(tags: Array<Tag>, name: string): string {
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (fromB64Url(tag.name).toString().toLowerCase() === name.toLowerCase()) {
      return fromB64Url(tag.value).toString();
    }
  }

  return '';
}

export function tagToUTF8(tags: Array<Tag>): Array<Tag> {
  const conversion: Array<Tag> = [];

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    conversion.push({
      name: fromB64Url(tag.name).toString(),
      value: fromB64Url(tag.value).toString(),
    });
  }

  return conversion;
}

export function tagToB64(tags: Array<TagFilter>): Array<TagFilter> {
  const conversion: Array<TagFilter> = [];

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    conversion.push({
      name: toB64url(tag.name),
      values: tag.values.map((v) => toB64url(v)),
    });
  }

  return conversion;
}
