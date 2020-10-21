import * as chai from "chai";
import { S3Driver } from "../../src/lib/storage/driver/s3";
import { streamToBuffer } from "../../src/lib/streams";

const expect = chai.expect;

describe("S3 storage", function () {
  const driver = new S3Driver();
  it("should read and write using s3 driver", async function () {
    this.timeout(20000);
    const testData = Buffer.from("test-string");

    const testKey = "test/temp/data.bin";

    const {
      stream: writeStream,
      onUploadComplete,
    } = await driver.putObjectStream(testKey, {
      contentType: "text/plain",
      contentLength: testData.byteLength,
    });

    writeStream.write(testData);

    writeStream.end();

    await onUploadComplete;

    const { stream: readStream } = await driver.getObjectStream(testKey);

    const buffer = await streamToBuffer(readStream);

    expect(buffer.toString()).to.equal(testData.toString());
  });
});
