import {dir, write, remove} from 'fs-jetpack';
import {DataItemJson} from 'arweave-bundles';
import {ansBundles} from '../utility/ans.utility';
import {getDataFromChunks} from '../query/node.query';
import {tagToUTF8} from '../query/transaction.query';

export async function streamAndCacheAns(id: string): Promise<boolean> {
  try {
    dir(`${process.cwd()}/cache/tx`);

    const rawData = await getDataFromChunks(id);
    const ansTxs = await ansBundles.unbundleData(rawData.toString('utf-8'));

    const ansTxsConverted: Array<DataItemJson> = [];

    for (let i = 0; i < ansTxs.length; i++) {
      const ansTx = ansTxs[i];
      const newAnsTx: DataItemJson = {
        id: ansTx.id,
        owner: ansTx.owner,
        target: ansTx.target,
        nonce: ansTx.nonce,
        data: ansTx.data,
        signature: ansTx.signature,
        tags: tagToUTF8(ansTx.tags),
      };
      
      ansTxsConverted.push(newAnsTx);
    }

    write(`${process.cwd()}/cache/tx/${id}`, JSON.stringify(ansTxsConverted, null, 2));

    return true;
  } catch (error) {
    remove(`${process.cwd()}/cache/tx/${id}`);
    console.error(`error caching data from ${id}, please note that this may be a cancelled transaction`.red.bold);
    throw error;
  }
}
