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
import { getArgs, templates, SUPPORTED_PLATFORMS } from './lib/util';

process.on('unhandledRejection', err => {
  console.error(err);
  process.exit(1);
});

process.on('uncaughtException', err => {
  console.error(err);
  process.exit(1);
});

const INTENT_PATH = `${__dirname}/output/intents`;
const ENTITY_PATH = `${__dirname}/output/entities`;
const ZIP_PATH = `${process.cwd()}/output.zip`;

const mkdirpP = promisify(mkdirp);
const execP = promisify(exec);
const log = debug('*');

(async argv => {
  // Parse args passed on execution
  const { isInDebug = false, hostname = 'app' } = getArgs(argv);
  const client = new SDKWrapper({ isInDebug, hostname });
  client.on('error', err => {
    log(`SDK encountered an error:\n ${err.stack}`);
  });
  try {
    log('initializing client');
    let semaphore;
    const {
      platform,
      board,
      intents,
      messagesFromIntents
    } = await client.init();
    await mkdirpP(INTENT_PATH);
    await mkdirpP(ENTITY_PATH);
    try {
      log('beginning write phase');
      // Attempt to limit num concurrent writes (for large projects)
      semaphore = new Sema(os.cpus().length, {
        capacity: messagesFromIntents.size
      });
      // Create instance of platform-specific class to map responses
      const provider = new Provider(platform);
      // We need all possible ways of arriving at each collection of messages
      // that flows from an intent as well as the ability to describe each history
      // of arrival (as a set of intent ids); given this we can create intent
      // files with correct input and output contexts easily
      await Promise.all(
        board.messages
          .filter(({ message_id }) => messagesFromIntents.has(message_id))
          .map(async message => {
            await semaphore.acquire();
            const intentAncestries = getIntentAncestries(
              message.message_id,
              message.previous_message_ids
            );
            // console.log(`\n${message.payload.text}`);
            for (const ancestry of intentAncestries) {
              const intent = intents.get(Array.from(ancestry).shift());
              const basename = Array.from(ancestry)
                .map(id => intents.get(id).name)
                .join('_');
              const intentFilepath = `${INTENT_PATH}/${basename}-${uuid()}.json`;
              const intermediateNodes = collectIntermediateNodes(
                message.next_message_ids
              ).map(id =>
                board.messages.find(message => message.message_id === id)
              );
              await fs.promises.writeFile(
                intentFilepath,
                JSON.stringify({
                  ...templates.intent,
                  id: uuid(),
                  name: basename,
                  contexts: ancestry,
                  events: isWelcomeIntent(message.message_id)
                    ? [{ name: 'WELCOME' }]
                    : [],
                  lastUpdate: Date.parse(intent.updated_at.date),
                  responses: [
                    {
                      action: '',
                      speech: [],
                      parameters: [],
                      resetContexts: false,
                      affectedContexts: message.next_message_ids
                        .filter(message => message.intent)
                        .map(name => ({
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
              const utterancesFilepath = `${intentFilepath.slice(
                0,
                -5
              )}_usersays_en.json`;
              try {
                await fs.promises.access(utterancesFilepath, fs.constants.F_OK);
              } catch (_) {
                // If we do not already have an utterances file for this intent, write a file
                if (
                  Array.isArray(intent.utterances) &&
                  intent.utterances.length
                ) {
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
                        // Appends `data` by iterating over the variables occurances in
                        // the text, adding previous and final blocks when necessary
                        for (const [id, [start, end]] of Object.entries(
                          pairs
                        )) {
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
            }
            semaphore.release();
          })
      );
      // Determines if `id` is the node adjacent to root with max number of connections
      function isWelcomeIntent(id) {
        const messageIsRoot = message =>
          board.root_messages.includes(message.message_id);
        const messages = messagesFromIntents.size
          ? board.messages.filter(message =>
              messagesFromIntents.has(message.message_id)
            )
          : board.messages;
        const [{ message_id }] = messages.sort(
          (a, b) =>
            b.previous_message_ids.filter(messageIsRoot).length -
            a.previous_message_ids.filter(messageIsRoot).length
        );
        return id === message_id;
      }
      // Recursively finds reachable nodes that do not emanate intents
      function collectIntermediateNodes(nextMessages, collectedIds = []) {
        for (const { message_id } of nextMessages) {
          if (!messagesFromIntents.has(message_id)) {
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
      }
      // Recursively builds set of sets containing intent lineage capable of
      // reaching the given messageId
      function getIntentAncestries(
        messageId,
        previousMessages,
        ancestries = new Set([new Set([])])
      ) {
        for (const { message_id } of previousMessages) {
          // Finds the board data for this previous message
          const message = board.messages.find(
            message => message.message_id === message_id
          );
          // Finds any intents incident on this previous message
          const intentsOnMessage = message.next_message_ids
            .filter(
              message =>
                message.intent &&
                message.intent.value &&
                message.message_id === messageId
            )
            .map(message => messagesFromIntents.get(message.message_id));
          // console.log(
          //   board.messages.find(message => message.message_id === messageId)
          //     .payload.text
          // );
          // console.log(intentsOnMessage);
          if (intentsOnMessage.length) {
            const lastAncestry = Array.from(ancestries).pop();
            return getIntentAncestries(
              message_id,
              message.previous_message_ids,
              ancestries.add(
                new Set([
                  ...intentsOnMessage
                  // ...(typeof lastAncestry !== 'string'
                  //   ? lastAncestry
                  //   : [lastAncestry])
                ])
              )
            );
          } else {
            return getIntentAncestries(
              message_id,
              message.previous_message_ids,
              ancestries
            );
          }
        }
        // Insert the welcome intent in each set
        const [welcomeIntent] = Array.from(intents).shift();
        ancestries.forEach(set => {
          set.add(welcomeIntent);
        });
        return ancestries;
      }
    } catch (err) {
      if (semaphore && semaphore.nrWaiting() > 0) {
        await semaphore.drain();
      }
      throw err;
    }
    // Write entity files in one-to-one correspondence with original project
    for (const entity of await client.getEntities()) {
      const serialEntityData = JSON.stringify({
        ...templates.entity,
        id: uuid(),
        name: entity.name
      });
      await fs.promises.writeFile(
        `${ENTITY_PATH}/${entity.name}.json`,
        serialEntityData
      );
      const serialSynData = JSON.stringify(entity.data);
      await fs.promises.writeFile(
        `${ENTITY_PATH}/${entity.name}_entries_en.json`,
        serialSynData
      );
    }
    // Copy template files into output directory
    for (const filename of await fs.promises.readdir(
      `${__dirname}/templates`
    )) {
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
      await fs.promises.access(ZIP_PATH, fs.constants.F_OK);
      await fs.promises.unlink(ZIP_PATH);
    } catch (_) {
    } finally {
      log('zipping output directory');
      await execP(`zip -r ${__dirname}/output.zip ${__dirname}/output`);
      await execP(`rm -rf ${__dirname}/output`);
    }
    log('done');
  } catch (err) {
    console.error(err.stack);
    process.exit(1);
  }
})(process.argv);
