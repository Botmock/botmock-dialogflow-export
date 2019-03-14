(await import('dotenv')).config();
import debug from 'debug';
import mkdirp from 'mkdirp';
import Sema from 'async-sema';
import uuid from 'uuid/v4';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Provider } from './lib/providers';
import { SDKWrapper } from './lib/util/SDKWrapper';
import { getArgs, templates } from './lib/util';

const DIALOGFLOW_CONTEXT_LIMIT = 5;
const SUPPORTED_PLATFORMS = new Set(['facebook', 'slack', 'skype']);
const INTENT_PATH = `${__dirname}/output/intents`;
const ENTITY_PATH = `${__dirname}/output/entities`;
const ZIP_PATH = `${__dirname}/output.zip`;
const mkdirpP = promisify(mkdirp);
const execP = promisify(exec);
const log = debug('*');

(async argv => {
  try {
    const { isInDebug = false, hostname = 'app' } = getArgs(argv);
    const client = new SDKWrapper({ isInDebug, hostname });
    client.on('error', err => {
      log(`SDK encountered an error:\n ${err.stack}`);
    });
    log('initializing client');
    const { platform, board, intents } = await client.init();
    const messagesDirectlyFollowingIntents = new Map();
    for (const { next_message_ids } of board.messages) {
      for (const { message_id, intent } of next_message_ids) {
        if (intent.value) {
          messagesDirectlyFollowingIntents.set(message_id, intent.value);
        }
      }
    }
    // Determines if `id` is the node adjacent to root with max number of connections
    const isWelcomeIntent = id => {
      const messageIsRoot = message => board.root_messages.includes(message.message_id);
      return Object.is(
        board.messages
          .filter(message => messagesDirectlyFollowingIntents.has(message.message_id))
          .sort(
            (a, b) =>
              b.previous_message_ids.filter(messageIsRoot).length -
              a.previous_message_ids.filter(messageIsRoot).length
          )[0].message_id,
        id
      );
    };
    // Recursively finds reachable nodes that do not emanate intents
    const collectIntermediateNodes = (nextMessages, collectedIds = []) => {
      for (const { message_id } of nextMessages) {
        if (!messagesDirectlyFollowingIntents.has(message_id)) {
          const { next_message_ids } = board.messages.find(
            message => message.message_id === message_id
          );
          return collectIntermediateNodes(next_message_ids, [
            ...collectedIds,
            message_id
          ]);
        }
      }
      return collectedIds;
    };
    // Recursively finds intent values on `previousMessages` until branching factor > 1
    const getIntentAncestry = (previousMessages = [], intentValues = []) => {
      const [messageFollowingIntent, ...rest] = previousMessages.filter(message =>
        messagesDirectlyFollowingIntents.has(message.message_id)
      );
      if (messageFollowingIntent && !rest.length) {
        const { previous_message_ids } = board.messages.find(
          message => message.message_id === messageFollowingIntent.message_id
        );
        const value = messagesDirectlyFollowingIntents.get(
          messageFollowingIntent.message_id
        );
        if (
          !intentValues.includes(value) &&
          intentValues.length < DIALOGFLOW_CONTEXT_LIMIT
        ) {
          // Recur with the intent on the sole message following from an intent at this depth
          return getIntentAncestry(previous_message_ids, [value, ...intentValues]);
        }
      } else if (!messageFollowingIntent && !rest.length) {
        for (const { message_id } of previousMessages) {
          const { previous_message_ids } = board.messages.find(
            message => message.message_id === message_id
          );
          return getIntentAncestry(previous_message_ids, intentValues);
        }
      }
      return intentValues;
    };
    await mkdirpP(INTENT_PATH);
    await mkdirpP(ENTITY_PATH);
    let semaphore;
    try {
      semaphore = new Sema(os.cpus().length, {
        capacity: messagesDirectlyFollowingIntents.size
      });
      const provider = new Provider(platform);
      log('beginning write phase');
      // Writes intent files corresponding to enumeration of intent ancestry for each message
      // that directly follows an intent. Intent files have as `responses` all messages between
      // this message and the next message that immediately follows an intent.
      await Promise.all(
        board.messages
          .filter(message => messagesDirectlyFollowingIntents.has(message.message_id))
          .map(async message => {
            await semaphore.acquire();
            const intent = intents.get(
              messagesDirectlyFollowingIntents.get(message.message_id)
            );
            const intentAncestry = getIntentAncestry(message.previous_message_ids).map(
              value => intents.get(value).name
            );
            const basename = [...intentAncestry, intent.name].join('_');
            const intermediateNodes = collectIntermediateNodes(
              message.next_message_ids
            ).map(id => board.messages.find(message => message.message_id === id));
            const intentFilepath = `${INTENT_PATH}/${basename}-${uuid()}.json`;
            await fs.promises.writeFile(
              intentFilepath,
              JSON.stringify({
                ...templates.intent,
                id: uuid(),
                name: basename,
                contexts: intentAncestry,
                events: isWelcomeIntent(message.message_id) ? [{ name: 'WELCOME' }] : [],
                lastUpdate: Date.parse(intent.updated_at.date),
                responses: [
                  {
                    action: '',
                    speech: [],
                    parameters: [],
                    resetContexts: false,
                    affectedContexts: [...intentAncestry, intent.name].map(name => ({
                      name,
                      parameters: {},
                      lifespan: 1
                    })),
                    defaultResponsePlatforms: SUPPORTED_PLATFORMS.has(
                      platform.toLowerCase()
                    )
                      ? { [platform.toLowerCase()]: true }
                      : {},
                    messages: [message, ...intermediateNodes].map(message =>
                      provider.create(message.message_type, message.payload)
                    )
                  }
                ]
              })
            );
            const utterancesFilepath = `${intentFilepath.slice(0, -5)}_usersays_en.json`;
            // Writes new file in the case of no preexisting file by the same name
            try {
              await fs.promises.access(utterancesFilepath, fs.constants.F_OK);
            } catch (_) {
              if (Array.isArray(intent.utterances) && intent.utterances.length) {
                await fs.promises.writeFile(
                  utterancesFilepath,
                  JSON.stringify(
                    intent.utterances.map(utterance => {
                      const data = [];
                      // Keeps relation of variable id and its location in the text
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
                        updated: Date.parse(intent.updated_at.date)
                      };
                    })
                  )
                );
              }
            }
            semaphore.release();
          })
      );
    } catch (err) {
      if (semaphore && semaphore.nrWaiting() > 0) {
        await semaphore.drain();
      }
      throw err;
    }
    // Write entity files
    for (const entity of await client.getEntities()) {
      const serialEntityData = JSON.stringify({
        ...templates.entity,
        id: uuid(),
        name: entity.name
      });
      await fs.promises.writeFile(`${ENTITY_PATH}/${entity.name}.json`, serialEntityData);
      const serialSynData = JSON.stringify(entity.data);
      await fs.promises.writeFile(
        `${ENTITY_PATH}/${entity.name}_entries_en.json`,
        serialSynData
      );
    }
    // Copy template files
    for (const filename of await fs.promises.readdir(`${__dirname}/templates`)) {
      if (filename.startsWith('intent') || filename.startsWith('entity')) {
        continue;
      }
      await fs.promises.copyFile(
        `${__dirname}/templates/${filename}`,
        `${__dirname}/output/${filename}`
      );
    }
    // Remove zip file if it exists; then zip and remove output dir
    try {
      log('zipping output directory');
      await fs.promises.access(ZIP_PATH, fs.constants.F_OK);
      await fs.promises.unlink(ZIP_PATH);
    } catch (_) {
    } finally {
      await execP(`zip -r ${__dirname}/output.zip ${__dirname}/output`);
      await execP(`rm -rf ${__dirname}/output`);
    }
    log('done');
  } catch (err) {
    log(err.stack);
    process.exit(1);
  }
})(process.argv);

process.on('unhandledRejection', err => {
  log(err.stack);
  process.exit(1);
});

process.on('uncaughtException', err => {
  log(err.stack);
  process.exit(1);
});
