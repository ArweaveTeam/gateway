import { startRescan } from './database/rescan.database';

(async () => await startRescan('.rescan.temp'))();
