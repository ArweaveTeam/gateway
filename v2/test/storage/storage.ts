import * as chai from "chai";
import { LocalStorageDriver } from "../../src/lib/storage/driver/local-driver";
import { streamToBuffer } from "../../src/lib/streams";

const expect = chai.expect;

describe("Local storage", function () {
  const driver = new LocalStorageDriver();

  it("should read and write using local storage driver", async function () {
    const testData = "test-string";

    const testKey = "test/temp/data.bin";

    const { stream: writeStream } = await driver.putObjectStream(testKey);

    writeStream.write(Buffer.from(testData));

    writeStream.end();

    const { stream: readStream } = await driver.getObjectStream(testKey);

    const buffer = await streamToBuffer(readStream);

    expect(buffer.toString()).to.equal(testData);
  });
});
