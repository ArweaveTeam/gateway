import { closeSync, openSync, utimesSync } from 'fs';

export function touch(path: string) {
  const time = new Date();
  try {
    utimesSync(path, time, time);
  } catch (err) {
    closeSync(openSync(path, 'w'));
  }
}