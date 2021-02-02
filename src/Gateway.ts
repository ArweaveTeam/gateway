import 'colors';
import {config} from 'dotenv';
import {program} from 'commander';
import {start} from './server/application.server';

export async function gateway() {
  config();

  program
      .description(`Arweave Gateway | The CLI tool to deploy Arweave Gateways`);

  program
      .command(`start`)
      .description(`Start the Arweave Gateway`)
      .action(() => {
        start();
      });

  program.parse(process.argv);
}

(async () => await gateway())();
