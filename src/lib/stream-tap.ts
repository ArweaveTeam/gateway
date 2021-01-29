import { Transform, Writable } from 'stream'

export class StreamTap extends Transform {
  protected outputStream: Writable;
  protected bytesProcessed: number = 0;

  constructor(outputStream: Writable) {
    super({ objectMode: false })
    this.outputStream = outputStream
  }

  _transform(chunk: Buffer, encoding: any, callback: Function) {
    this.outputStream.write(chunk)
    this.bytesProcessed += chunk.byteLength
    this.push(chunk)
    callback()
  }

  getBytesProcessed() {
    return this.bytesProcessed
  }
}
