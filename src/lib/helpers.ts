import { chunk } from 'lodash'

/**
 * Split a large array into batches and process each batch sequentially,
 * using an awaited async function.
 * @param items
 * @param batchSize
 * @param func
 */
export const sequentialBatch = async (
    items: any[],
    batchSize = 10,
    func: Function,
) => {
  const batches = chunk(items, batchSize)

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    await func(batch)
  }
}

export const wait = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
