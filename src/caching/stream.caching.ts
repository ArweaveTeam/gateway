import {createWriteStream} from 'fs';
import {dir, remove} from 'fs-jetpack';
import {cacheFolder} from './file.caching';
import {getTransactionOffset, getChunk} from '../query/chunk.query';

export async function streamAndCacheTx(id: string): Promise<boolean> {
  try {
    dir(`${cacheFolder}`);

    const fileStream = createWriteStream(`${cacheFolder}/${id}`, {flags: 'w'});
    const {startOffset, endOffset} = await getTransactionOffset(id);

    let byte = 0;

    while (startOffset + byte < endOffset) {
      const chunk = await getChunk(startOffset + byte);
      byte += chunk.parsed_chunk.length;

      fileStream.write(Buffer.from(chunk.parsed_chunk));
    }

    fileStream.end();

    return true;
  } catch (error) {
    remove(`${cacheFolder}/${id}`);
    console.error(`error caching data from ${id}, please note that this may be a cancelled transaction`.red.bold);
    throw error;
  }
}
