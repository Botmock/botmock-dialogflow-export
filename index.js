import { stdout } from 'single-line-log';
import mkdirp from 'mkdirp';
import Sema from 'async-sema';
import uuid from 'uuid/v4';
import env from 'node-env-file';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Provider } from './lib/providers';
import { SDKWrapper } from './lib/util/SDKWrapper';
import { getArgs, templates } from './lib/util';

env(`${__dirname}/.env`);

const SUPPORTED_PLATFORMS = new Set(['facebook', 'slack', 'skype']);
const INTENT_PATH = `${__dirname}/output/intents`;
const ENTITY_PATH = `${__dirname}/output/entities`;
const mkdirpP = promisify(mkdirp);
const execP = promisify(exec);

const start = process.hrtime();
(async argv => {
  try {
    const { isInDebug = false, hostname = 'app' } = getArgs(argv);
    // Create an instance of the SDK and get the initial project payload
    const client = new SDKWrapper({ isInDebug, hostname });
    const { platform, board } = await client.init();
    // Pair messages that directly follow from intents with the intent they follow
    const messagesDirectlyFollowingIntents = new Map();
    for (const { next_message_ids } of board.messages) {
      for (const { message_id, intent } of next_message_ids) {
        if (typeof intent.value === 'string') {
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
      const [messageFollowingIntent, ...rest] =
        previousMessages.filter(message =>
          messagesDirectlyFollowingIntents.has(message.message_id)
        ) || [];
      if (messageFollowingIntent && !rest.length) {
        const { previous_message_ids } = board.messages.find(
          message => message.message_id === messageFollowingIntent.message_id
        );
        const value = messagesDirectlyFollowingIntents.get(
          messageFollowingIntent.message_id
        );
        if (!intentValues.includes(value)) {
          // Recur with the intent of the sole message following from an intent at this depth
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
      // Given the ability to see if a node follows directly from an intent, we can iterate
      // over all that do and exhaustively collect node content up to the nodes that emanate
      // new intents or are themselves leaf nodes. We write one file per intent that has as
      // `responses` the content of such intermediate nodes.
      await Promise.all(
        board.messages
          .filter(message => messagesDirectlyFollowingIntents.has(message.message_id))
          .map(async (message, i) => {
            // stdout(`\nwriting ${i + 1} of ${messagesDirectlyFollowingIntents.size}`);
            await semaphore.acquire();
            const intent = await client.getIntent(
              messagesDirectlyFollowingIntents.get(message.message_id)
            );
            const intentAncestry = (await Promise.all(
              getIntentAncestry(message.previous_message_ids).map(
                async value => await client.getIntent(value)
              )
            )).map(intent => intent.name);
            const basename = [...intentAncestry, intent.name].join('_');
            const intentFilepath = `${INTENT_PATH}/${basename}.json`;
            const { date = new Date() } = intent.updated_at || {};
            const intermediateNodes = collectIntermediateNodes(
              message.next_message_ids
            ).map(id => board.messages.find(message => message.message_id === id));
            const serialIntentData = JSON.stringify({
              ...templates.intent,
              id: uuid(),
              name: basename,
              contexts: intentAncestry,
              events: isWelcomeIntent(message.message_id) ? [{ name: 'WELCOME' }] : [],
              lastUpdate: Date.parse(date),
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
            });
            await fs.promises.writeFile(intentFilepath, serialIntentData);
            const utterancesFilepath = `${intentFilepath.slice(0, -5)}_usersays_en.json`;
            try {
              await fs.promises.access(utterancesFilepath, fs.constants.F_OK);
            } catch (_) {
              if (Array.isArray(intent.utterances) && intent.utterances.length) {
                const serialUtterancesData = JSON.stringify(
                  Array.from(
                    intent.utterances.map(utterance => ({
                      id: uuid(),
                      data: [{ text: utterance.text, userDefined: false }],
                      count: 0,
                      isTemplate: false,
                      updated: Date.parse(date)
                    }))
                  )
                );
                await fs.promises.writeFile(utterancesFilepath, serialUtterancesData);
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
    // Zip output dir; remove it afterwards
    await execP(`zip -r ${__dirname}/output.zip ${__dirname}/output`);
    await execP(`rm -rf ${__dirname}/output`);
    const [seconds, nanoseconds] = process.hrtime(start);
    const NS_PER_SEC = 1e9;
    const NS_PER_MS = 1e6;
    stdout(`done in ${((seconds * NS_PER_SEC + nanoseconds) / NS_PER_MS).toFixed(2)}ms`);
  } catch (err) {
    console.error(err.stack);
    process.exit(1);
  }
})(process.argv);

process.on('unhandledRejection', err => {
  console.error(err.stack);
  process.exit(1);
});

process.on('uncaughtException', err => {
  console.error(err.stack);
  process.exit(1);
});
