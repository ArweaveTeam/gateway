import * as chai from "chai";
import { getObjectStream, putObjectStream } from "../src/lib/storage";
import { streamToBuffer } from "../src/lib/streams";

const expect = chai.expect;

describe("Local storage", function () {
  it("should read and write using local storage driver", async function () {
    const testData = "test-string";

    const testKey = "test/temp/data.bin";

    const { stream: writeStream } = await putObjectStream(testKey);

    writeStream.write(Buffer.from(testData));

    writeStream.end();

    const { stream: readStream } = await getObjectStream(testKey);

    const buffer = await streamToBuffer(readStream);

    expect(buffer.toString()).to.equal(testData);
  });
});
