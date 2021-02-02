export const NODES = process.env.ARWEAVE_NODES ? JSON.parse(process.env.ARWEAVE_NODES) : ['http://lon-1.eu-west-1.arweave.net:1984'];

export function grabNode() {
  return NODES[Math.floor(Math.random() * NODES.length)];
}
