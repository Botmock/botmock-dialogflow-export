(await import('dotenv')).config();
import * as utils from '@botmock-api/utils';
import camelcase from 'camelcase';
import mkdirp from 'mkdirp';
import Sema from 'async-sema';
import uuid from 'uuid/v4';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import { Provider } from './lib/providers';
import { SDKWrapper } from './lib/util/SDKWrapper';
import {
  getArgs,
  templates,
  SUPPORTED_PLATFORMS,
  ZIP_PATH,
  OUTPUT_PATH,
  INTENT_PATH,
  ENTITY_PATH
} from './lib/util';

// create directories for intents and entities
await util.promisify(mkdirp)(INTENT_PATH);
await util.promisify(mkdirp)(ENTITY_PATH);

// boot up client with any args passed from command line
const client = new SDKWrapper(getArgs(process.argv));
client.on('error', err => {
  console.error(err);
  process.exit(1);
});

let { platform, board, intents } = await client.init();
if (platform === 'google-actions') {
  platform = 'google';
}

const intentMap = utils.createIntentMap(board.messages);
const collectIntermediateNodes = utils.createNodeCollector(
  intentMap,
  getMessage
);

let semaphore;
try {
  // limit write concurrency
  semaphore = new Sema(os.cpus().length, { capacity: intentMap.size });
  const provider = new Provider(platform);
  (async () => {
    // set a welcome-like intent if no intent from the root is defined
    if (!intentMap.size) {
      const { next_message_ids } = board.messages.find(messageIsRoot);
      const [{ message_id: firstNodeId }] = next_message_ids;
      // add uuid to the map's value for use in the write loop below
      intentMap.set(firstNodeId, [uuid()]);
    }
    // write intent and utterances files for each combination of (message, intent)
    for (const [key, intentIds] of intentMap.entries()) {
      await semaphore.acquire();
      const {
        message_type,
        payload,
        next_message_ids,
        previous_message_ids
      } = getMessage(key);
      for (const intent of intentIds) {
        const { name, updated_at, utterances } = intents.get(intent) || {
          name: 'welcome',
          updated_at: Date.now(),
          utterances: []
        };
        const basename = `${name}_${camelcase(payload.nodeName)}`;
        const filePath = `${INTENT_PATH}/${basename}.json`;
        // group together the nodes that do not create intents
        const intermediateNodes = collectIntermediateNodes(
          next_message_ids
        ).map(getMessage);
        await fs.promises.writeFile(
          filePath,
          JSON.stringify({
            ...templates.intent,
            id: uuid(),
            name: basename,
            contexts: hasWelcomeIntent(key) ? [] : [intents.get(intent).name],
            events: hasWelcomeIntent(key) ? [{ name: 'WELCOME' }] : [],
            lastUpdate: Date.parse(updated_at.date),
            responses: [
              {
                action: '',
                speech: [],
                parameters: [],
                resetContexts: false,
                // set affected contexts as the union of the intents going out of
                // any intermediate nodes and those that go out of _this_ node
                affectedContexts: [
                  ...intermediateNodes.reduce((acc, { next_message_ids }) => {
                    if (!next_message_ids.length) {
                      return acc;
                    }
                    return [
                      ...acc,
                      ...next_message_ids
                        .filter(({ intent }) => !!intent.value)
                        .map(({ intent: { value } }) => ({
                          name: intents.get(value).name,
                          parameters: {},
                          lifespan: 1
                        }))
                    ];
                  }, []),
                  ...next_message_ids
                    .filter(({ intent }) => !!intent.value)
                    .map(({ intent: { value } }) => ({
                      name: intents.get(value).name,
                      parameters: {},
                      lifespan: 1
                    }))
                ],
                defaultResponsePlatforms: SUPPORTED_PLATFORMS.has(
                  platform.toLowerCase()
                )
                  ? { [platform.toLowerCase()]: true }
                  : {},
                messages: [{ message_type, payload }, ...intermediateNodes].map(
                  message =>
                    provider.create(message.message_type, message.payload)
                )
              }
            ]
          })
        );
        if (Array.isArray(utterances) && utterances.length) {
          // write utterance file
          await fs.promises.writeFile(
            `${filePath.slice(0, -5)}_usersays_en.json`,
            JSON.stringify(
              utterances.map(utterance => {
                const data = [];
                const pairs = utterance.variables.reduce(
                  (acc, vari) => ({
                    ...acc,
                    [vari.id]: [
                      vari.start_index,
                      vari.start_index + vari.name.length
                    ]
                  }),
                  {}
                );
                let lastIndex = 0;
                for (const [id, [start, end]] of Object.entries(pairs)) {
                  const previousBlock = [];
                  if (start !== lastIndex) {
                    previousBlock.push({
                      text: utterance.text.slice(lastIndex, start),
                      userDefined: false
                    });
                  }
                  const { name, entity } = utterance.variables.find(
                    vari => vari.id === id
                  );
                  data.push(
                    ...previousBlock.concat({
                      text: name.slice(1, -1),
                      meta: `@${entity}`,
                      userDefined: true
                    })
                  );
                  if (id !== Object.keys(pairs).pop()) {
                    lastIndex = end;
                  } else {
                    data.push({
                      text: utterance.text.slice(end),
                      userDefined: false
                    });
                  }
                }
                return {
                  id: uuid(),
                  data: data.length
                    ? data
                    : [{ text: utterance.text, userDefined: false }],
                  count: 0,
                  isTemplate: false,
                  updated: Date.parse(updated_at.date)
                };
              })
            )
          );
        }
      }
      semaphore.release();
    }
  })();
  // write entity files in one-to-one correspondence with original project
  for (const entity of await client.getEntities()) {
    await fs.promises.writeFile(
      `${ENTITY_PATH}/${entity.name}.json`,
      JSON.stringify({
        ...templates.entity,
        id: uuid(),
        name: entity.name
      })
    );
    await fs.promises.writeFile(
      `${ENTITY_PATH}/${entity.name}_entries_en.json`,
      JSON.stringify(entity.data)
    );
  }
  for (const filename of await fs.promises.readdir(
    path.join(__dirname, 'templates')
  )) {
    const pathToContent = path.join(__dirname, 'templates', filename);
    const stats = await fs.promises.stat(pathToContent);
    // if this content of the templates directory is not itself a directory,
    // possibly copy the file over into the output directory
    if (!stats.isDirectory()) {
      if (filename.startsWith('intent') || filename.startsWith('entity')) {
        continue;
      }
      await copyFileToOutput(pathToContent);
    } else {
      // assume these are the templates for the default intents; copy them
      // into the intents directory
      for (const file of await fs.promises.readdir(pathToContent)) {
        await copyFileToOutput(path.join(pathToContent, file), {
          isIntentFile: true
        });
      }
    }
  }
  console.log(`Done. Compress ${path.sep}${path.basename(OUTPUT_PATH)}.`);
} catch (err) {
  if (semaphore && semaphore.nrWaiting() > 0) {
    await semaphore.drain();
  }
  console.error(err.stack);
  process.exit(1);
}

// copies file to its destination in output
async function copyFileToOutput(pathToFile, options = { isIntentFile: false }) {
  const pathToOutput = path.join(
    __dirname,
    'output',
    options.isIntentFile ? 'intents' : '',
    path.basename(pathToFile)
  );
  return await fs.promises.copyFile(pathToFile, pathToOutput);
}

// gets the message with this id from the board
function getMessage(id) {
  return board.messages.find(m => m.message_id === id);
}

// determines if given message is the root
function messageIsRoot(message) {
  return board.root_messages.includes(message.message_id);
}

// determines if given id is the node adjacent to root with max number of connections
function hasWelcomeIntent(id) {
  const messages = intentMap.size
    ? board.messages.filter(message => intentMap.has(message.message_id))
    : board.messages;
  const [{ message_id }] = messages.sort(
    (a, b) =>
      b.previous_message_ids.filter(messageIsRoot).length -
      a.previous_message_ids.filter(messageIsRoot).length
  );
  return id === message_id;
}
