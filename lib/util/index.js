import fs from 'fs';
import path from 'path';
import arg from 'arg';

export const ZIP_PATH = path.join(process.cwd(), 'output.zip');
export const OUTPUT_PATH = path.join(process.cwd(), 'output');
export const INTENT_PATH = path.join(OUTPUT_PATH, 'intents');
export const ENTITY_PATH = path.join(OUTPUT_PATH, 'entities');

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

export const SUPPORTED_PLATFORMS = new Set([
  'facebook',
  'slack',
  'skype',
  'google'
]);
