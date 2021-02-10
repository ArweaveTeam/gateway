import {existsSync, mkdirSync} from 'fs';

export function mkdir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path);
  }
}
