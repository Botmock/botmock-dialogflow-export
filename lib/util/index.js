import fs from 'fs';
import arg from 'arg';

export function getArgs(argv) {
  const args = arg(
    {
      '--debug': Boolean,
      '-d': '--debug',
      '--host': String,
      '-h': '--host'
    },
    { argv }
  );
  const isInDebug = args['--debug'];
  const hostname = args['--host'];
  return { isInDebug, hostname };
}

export const templates = {
  intent: JSON.parse(fs.readFileSync(`${process.cwd()}/templates/intent.json`))
};
