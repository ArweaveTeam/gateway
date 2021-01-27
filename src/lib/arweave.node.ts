export const NODES = process.env.ARWEAVE_NODES ? JSON.parse(process.env.ARWEAVE_NODES) : ['http://lon-1.eu-west-1.arweave.net:1984'];

export function GrabNode() {
    return NODES[Math.floor(Math.random() * NODES.length)];
}
