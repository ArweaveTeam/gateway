import { config } from 'dotenv';
import { get } from 'superagent';
import rwc from 'random-weighted-choice';
import { getTransactionOffset, getChunk } from './chunk.query';

config();

export const NODES = process.env.ARWEAVE_NODES
  ? JSON.parse(process.env.ARWEAVE_NODES)
  : ['http://lon-1.eu-west-1.arweave.net:1984'];

type WeightedNode = { id: string; weight: number };

const nodeTemperatures: WeightedNode[] = NODES.map((url: string) => ({
  id: url,
  weight: 1,
}));

export function grabNode() {
  return rwc(nodeTemperatures);
}

export function warmNode(url: string) {
  const item = nodeTemperatures.find((i: WeightedNode) => i.id === url);
  if (item) {
    item['weight'] = Math.max(item['weight'] + 1, 99);
  }
}

export function coolNode(url: string) {
  const item = nodeTemperatures.find((i: WeightedNode) => i.id === url);
  if (item) {
    item['weight'] = Math.min(item['weight'] - 1, 1);
  }
}

export interface InfoType {
  network: string;
  version: number;
  release: number;
  height: number;
  current: string;
  blocks: number;
  peers: number;
  queue_length: number;
  node_state_latency: number;
}

export function getNodeInfo(retry = 0): Promise<InfoType | void> {
  const tryNode = grabNode();

  return get(`${tryNode}/info`)
    .then((payload) => {
      const body = JSON.parse(payload.text);
      warmNode(tryNode);
      return {
        network: body.network,
        version: body.version,
        release: body.release,
        height: body.height,
        current: body.current,
        blocks: body.blocks,
        peers: body.peers,
        queue_length: body.queue_length,
        node_state_latency: body.node_state_latency,
      };
    })
    .catch(() => {
      return new Promise((res) => setTimeout(res, 10 + 2 * retry)).then(() => {
        if (retry < 100) {
          return getNodeInfo(retry + 1);
        } else {
          console.error(
            'Failed to establish connection to any specified node after 100 retries'
          );
          process.exit(1);
        }
      });
    });
}

export async function getData(id: string): Promise<any> {
  const payload = await get(`${grabNode()}/${id}`);
  return payload.body;
}

export function getDataAsStream(id: string) {
  return get(`${grabNode()}/${id}`);
}

export async function getDataFromChunks(
  id: string,
  retry: boolean = true
): Promise<Buffer> {
  try {
    const { startOffset, endOffset } = await getTransactionOffset(id);

    let byte = 0;
    let chunks = Buffer.from('');

    while (startOffset + byte < endOffset) {
      const chunk = await getChunk(startOffset + byte);
      byte += chunk.parsed_chunk.length;
      chunks = Buffer.concat([chunks, chunk.response_chunk]);
    }

    return chunks;
  } catch (error) {
    if (retry) {
      console.error(
        `error retrieving data from ${id}, please note that this may be a cancelled transaction`
          .red.bold
      );
      return await getDataFromChunks(id, false);
    } else {
      throw error;
    }
  }
}
