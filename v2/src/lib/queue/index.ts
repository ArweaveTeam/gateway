export type CreateQueue = (name: string) => Promise<void>;

export type Enqueue = <T = any>(name: string, message: T) => Promise<string>;

export interface QueueDriver {
  createQueue: CreateQueue;
  enqueue: Enqueue;
}
