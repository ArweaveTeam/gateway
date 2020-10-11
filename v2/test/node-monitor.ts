import * as chai from "chai";
import { getObjectStream, putObjectStream } from "../src/lib/storage";
import {
  setHosts,
  getNodes,
  getOnlineHosts,
  configureMonitoring,
} from "../src/network/nodes";
import Bluebird from "bluebird";

const expect = chai.expect;

describe("Node monitor", function () {
  it("should refresh node status and rank", async function () {
    const hosts = [
      "http://lon-1.eu-west-1.arweave.net:1984",
      "http://lon-2.eu-west-1.arweave.net:1984",
      "http://lon-3.eu-west-1.arweave.net:1984",
      "http://lon-4.eu-west-1.arweave.net:1984",
      "http://lon-5.eu-west-1.arweave.net:1984",
      "http://lon-6.eu-west-1.arweave.net:1984",
    ];

    setHosts(hosts);

    configureMonitoring({ enabled: true, interval: 30000, timeout: 2000 });

    console.log(getNodes());

    await Bluebird.delay(2000);

    console.log(getOnlineHosts());
  });
});
