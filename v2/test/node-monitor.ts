import * as chai from "chai";
import {
  setHosts,
  pingAndRank,
  getOnlineHosts,
  getNodes,
  configureMonitoring,
} from "../src/arweave/nodes";

const expect = chai.expect;

describe("Node monitor", function () {
  setHosts([
    "http://lon-1.eu-west-1.arweave.net:1984",
    "http://lon-2.eu-west-1.arweave.net:1984",
    "http://lon-3.eu-west-1.arweave.net:1984",
    "http://lon-4.eu-west-1.arweave.net:1984",
    "http://lon-5.eu-west-1.arweave.net:1984",
    "http://lon-6.eu-west-1.arweave.net:1984",
    "http://test.test",
  ]);
  configureMonitoring({
    enabled: true,
    interval: 5000,
    timeout: 2000,
    log: false,
  });

  it("should refresh node status and rank", async function () {
    const rankedNodes = await pingAndRank();

    // console.log(rankedNodes);

    expect(rankedNodes).to.be.an("array");

    expect(rankedNodes[0].responseTime).to.be.lte(rankedNodes[1].responseTime);

    expect(Object.keys(rankedNodes[0].response)).to.contain.members([
      "height",
      "current",
      "release",
      "version",
      "blocks",
      "queue_length",
      "node_state_latency",
    ]);

    expect(rankedNodes[0].online).to.be.true;

    // Even if all nodes are up, the presense of http://test.test means
    // at least one response must register as offline, so we can just
    // test the last one.
    expect(rankedNodes[rankedNodes.length - 1].online).to.be.false;
  });

  it("should return correct online hosts", async function () {
    expect(getOnlineHosts().length).to.equal(
      getNodes().filter((node) => node.online).length
    );

    expect(getOnlineHosts().length).to.lte(getNodes().length);
  });
});
