import {config} from 'dotenv';
import {read} from 'fs-jetpack';
import {Tag, tagValue} from '../query/transaction.query';

config();

export interface FilterValueI {
    id?: string;
    name?: string;
    value?: string;
}

export interface FilterI {
    filter: Array<FilterValueI>;
}

export const filterPath = process.env.FILTER ?? 'app.filter.json';
export const filters: Array<FilterI> = JSON.parse(read(filterPath) || '[]') as Array<FilterI>;

export function validateTransaction(id: string, tags: Array<Tag>): boolean {
  if (filters.length === 0) {
    return true;
  }
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];

    for (let ii = 0; ii < filter.filter.length; ii++) {
      const filterValue = filter.filter[ii];

      if (filterValue.id === id) {
        return true;
      }

      if (tagValue(tags, filterValue.name || '') === filterValue.value) {
        return true;
      }
    }
  }

  return false;
}
