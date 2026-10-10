import { config } from '../config.ts';
import { memoryStore } from './memory.ts';
import { tigerStore } from './tiger.ts';
import type { Store } from './types.ts';

export const store: Store = config.databaseUrl ? tigerStore(config.databaseUrl) : memoryStore();
export type * from './types.ts';
