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
  return {
    isInDebug: args['--debug'] || false,
    hostname: args['--host'] || 'app'
  };
}

export const templates = {
  intent: JSON.parse(fs.readFileSync(`${process.cwd()}/templates/intent.json`)),
  entity: JSON.parse(fs.readFileSync(`${process.cwd()}/templates/entity.json`))
};

export const SUPPORTED_PLATFORMS = new Set(['facebook', 'slack', 'skype']);
