import "dotenv/config";
import { createIntentMap, createMessageCollector } from "@botmock-api/utils";
import { remove } from "fs-extra";
import { Sema } from "async-sema";
import mkdirp from "mkdirp";
import uuid from "uuid/v4";
import os from "os";
import path from "path";
import util from "util";
import fs, { Stats } from "fs";
import BoardExplorer from "./lib/util/BoardExplorer";
import { getProjectData } from "./lib/util/client";
import { Provider } from "./lib/providers";
import { getArgs, templates, ZIP_PATH, SUPPORTED_PLATFORMS } from "./lib/util";

type ProjectResponse = Readonly<{
  data?: any[];
  errors?: any[];
}>;

type Intent = {
  name: string;
  updated_at: { date: string };
  utterances: { text: string; variables: any[] }[];
};

type Message = {
  message_type: string;
  intent: { value: string };
  payload: any;
};

type InputContext = string[];
type OutputContext = { name: string | void; parameters: {}; lifespan: number };

export const OUTPUT_PATH = path.join(__dirname, process.argv[2] || "output");

const MIN_NODE_VERSION = 101600;
const numericalNodeVersion = parseInt(
  process.version
    .slice(1)
    .split(".")
    .map(seq => seq.padStart(2, "0"))
    .join(""),
  10
);

if (numericalNodeVersion < MIN_NODE_VERSION) {
  throw new Error("requires node.js version 10.16.0 or greater");
}

// async function writeIntentFile(intent: Intent): Promise<void> {}

// async function writeUtterancesFile(intent: Intent): Promise<void> {}

let semaphore: void | Sema;
try {
  const INTENT_PATH = path.join(OUTPUT_PATH, "intents");
  const ENTITY_PATH = path.join(OUTPUT_PATH, "entities");
  const DEFAULT_INTENT = {
    name: "welcome",
    updated_at: Date.now(),
    utterances: [{ text: "hi", variables: [] }],
  };
  (async () => {
    await remove(OUTPUT_PATH);
    await util.promisify(mkdirp)(INTENT_PATH);
    await util.promisify(mkdirp)(ENTITY_PATH);
    // fetch project data via the botmock api
    const project: ProjectResponse = await getProjectData({
      projectId: process.env.BOTMOCK_PROJECT_ID,
      boardId: process.env.BOTMOCK_BOARD_ID,
      teamId: process.env.BOTMOCK_TEAM_ID,
      token: process.env.BOTMOCK_TOKEN,
    });
    let [intents, entities, board, { platform }] = project.data;
    if (platform === "google-actions") {
      platform = "google";
    }
    const intentMap = createIntentMap(board.messages, intents);
    const explorer = new BoardExplorer({ board, intentMap });
    const collectIntermediateMessages: any = createMessageCollector(
      intentMap,
      explorer.getMessageFromId.bind(explorer)
    );
    // get the name of an intent from its id
    const getNameOfIntent = (id: string): string => {
      const { name: intentName }: Intent = intents.find(i => i.id === id) || {};
      return intentName;
    };
    // find the context that is implied by a given message id that follows from
    // an intent by unwinding its intent history and returning this history as
    // an array of strings
    const getRequiredContext = (immediateMessageId: string): InputContext => {
      let context: string[] = [];
      // keep adding to context by searching previous messages for message ids
      // that follow from intents until more than one such previous message exists
      (function unwindFromMessageId(id: string): void {
        const { previous_message_ids } = explorer.getMessageFromId(id);
        for (const { message_id: previousId } of previous_message_ids) {
          if (!intentMap.get(previousId)) {
            unwindFromMessageId(previousId);
          } else {
            const [firstIntent, ...otherIntents] = intentMap.get(previousId);
            if (otherIntents.length) {
              return;
            }
            const name = getNameOfIntent(firstIntent);
            if (typeof name !== "undefined") {
              context.push(name);
            }
          }
        }
      })(immediateMessageId);
      return context;
    };
    const createOutputContextFromMessage = (
      message: Message
    ): OutputContext => ({
      name: getNameOfIntent(message.intent.value),
      parameters: {},
      lifespan: 1,
    });
    // set a welcome-like intent if no intent from the root is defined
    if (!intentMap.size || explorer.isMissingWelcomeIntent(board.messages)) {
      const { next_message_ids } = board.messages.find(
        explorer.messageIsRoot.bind(explorer)
      );
      const [{ message_id: firstNodeId }] = next_message_ids;
      intentMap.set(firstNodeId, [uuid()]);
    }
    // create instance of semaphore class to control write concurrency
    semaphore = new Sema(os.cpus().length, { capacity: intentMap.size || 1 });
    // create instance of class that maps the board payload to dialogflow format
    const provider = new Provider(platform);
    // for each message..
    for (const [messageId, intentIds] of intentMap.entries()) {
      const {
        message_type,
        payload,
        message_id,
        next_message_ids,
        previous_message_ids,
      } = explorer.getMessageFromId(messageId);
      // ..iterate over each intent id and write necessary intent and utterance files
      for (const intentId of intentIds) {
        await semaphore.acquire();
        try {
          // console.info(semaphore.nrWaiting());
          const { name, updated_at, utterances }: Partial<Intent> =
            intents.find(intent => intent.id === intentId) || DEFAULT_INTENT;
          const contexts = getRequiredContext(messageId);
          const basename = `${payload.nodeName}(${message_id})_${name}`;
          const filePath = path.join(INTENT_PATH, `${basename}.json`);
          const intermediateMessages = collectIntermediateMessages(
            next_message_ids
          ).map(explorer.getMessageFromId.bind(explorer));
          await fs.promises.writeFile(
            filePath,
            JSON.stringify(
              {
                ...templates.intent,
                id: uuid(),
                name: basename,
                contexts,
                events: explorer.hasWelcomeIntent(messageId)
                  ? [{ name: "WELCOME" }]
                  : [],
                lastUpdate: Date.parse(updated_at.date),
                responses: [
                  {
                    action: "",
                    speech: [],
                    parameters: [],
                    resetContexts: false,
                    affectedContexts: [
                      ...intermediateMessages.reduce(
                        (acc, { next_message_ids }) => {
                          if (!next_message_ids.length) {
                            return acc;
                          }
                          return [
                            ...acc,
                            ...next_message_ids
                              .filter(({ intent }) => !!intent.value)
                              .map(createOutputContextFromMessage),
                          ];
                        },
                        []
                      ),
                      ...next_message_ids
                        .filter(({ intent }) => !!intent.value)
                        .map(createOutputContextFromMessage),
                    ],
                    defaultResponsePlatforms: SUPPORTED_PLATFORMS.has(
                      platform.toLowerCase()
                    )
                      ? { [platform.toLowerCase()]: true }
                      : {},
                    // set messages as the union of this message and all intermediate messages
                    messages: [
                      { message_type, payload },
                      ...intermediateMessages,
                    ]
                      .reduce((acc, message) => {
                        const findLimitForType = (type: string): number => {
                          return +Infinity;
                        };
                        const messageIsOverLimit = (limit: number): boolean =>
                          acc.filter(
                            ({ message_type }) =>
                              message_type === message.message_type
                          ).length >= limit;
                        // if adding one more of this message would cause import to fail, omit it
                        if (
                          messageIsOverLimit(
                            findLimitForType(message.message_type)
                          )
                        ) {
                          console.warn(
                            `truncating ${message.message_type} response`
                          );
                          return acc;
                        }
                        return [...acc, message];
                      }, [])
                      // ensure chat bubbles come before cards to abide by dialogflow's rule
                      .sort(
                        (a, b) => a.message_type.length - b.message_type.length
                      )
                      .map(message =>
                        provider.create(message.message_type, message.payload)
                      ),
                  },
                ],
              },
              null,
              2
            ) + os.EOL
          );
          if (Array.isArray(utterances) && utterances.length) {
            // write utterance file
            await fs.promises.writeFile(
              `${filePath.slice(0, -5)}_usersays_en.json`,
              JSON.stringify(
                utterances.map(utterance => {
                  const data = [];
                  // reduce variables into lookup table of (start, end)
                  // indices for that variable id
                  const pairs: any[] = utterance.variables.reduce(
                    (acc, vari) => ({
                      ...acc,
                      [vari.id]: [
                        vari.start_index,
                        vari.start_index + vari.name.length,
                      ],
                    }),
                    {}
                  );
                  let lastIndex = 0;
                  // save slices of text based on pair data
                  for (const [id, [start, end]] of Object.entries(pairs)) {
                    const previousBlock = [];
                    if (start !== lastIndex) {
                      previousBlock.push({
                        text: utterance.text.slice(lastIndex, start),
                        userDefined: false,
                      });
                    }
                    const { name, entity: entityId } = utterance.variables.find(
                      vari => vari.id === id
                    );
                    const { name: entityName } = entities.find(
                      en => en.id === entityId
                    );
                    data.push(
                      ...previousBlock.concat({
                        text: name.slice(1, -1),
                        meta: `@${entityName}`,
                        userDefined: true,
                      })
                    );
                    if (id !== Object.keys(pairs).pop()) {
                      lastIndex = end;
                    } else {
                      data.push({
                        text: utterance.text.slice(end),
                        userDefined: false,
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
                    updated: Date.parse(updated_at.date),
                  };
                }),
                null,
                2
              ) + os.EOL
            );
          }
        } catch (err) {
          if (semaphore.nrWaiting()) {
            await semaphore.drain();
          }
          throw err;
        } finally {
          semaphore.release();
        }
      }
    }
    // write an entity file for each entity in the project
    for (const entity of entities) {
      await fs.promises.writeFile(
        path.join(ENTITY_PATH, `${entity.name}.json`),
        JSON.stringify({
          ...templates.entity,
          id: uuid(),
          name: entity.name,
        }) + os.EOL
      );
      await fs.promises.writeFile(
        path.join(ENTITY_PATH, `${entity.name}_entries_en.json`),
        JSON.stringify(entity.data) + os.EOL
      );
    }
    // copy templates over to the output destination
    for (const filename of await fs.promises.readdir(
      path.join(__dirname, "templates")
    )) {
      const pathToContent = path.join(__dirname, "templates", filename);
      const stats: Stats = await fs.promises.stat(pathToContent);
      // if this content of the templates directory is not itself a directory,
      // possibly copy the file over into the output directory
      if (!stats.isDirectory()) {
        if (filename.startsWith("intent") || filename.startsWith("entity")) {
          continue;
        }
        await copyFileToOutput(pathToContent);
      } else {
        // assume these are the templates for the default intents; copy them
        // into the intents directory
        for (const file of await fs.promises.readdir(pathToContent)) {
          await copyFileToOutput(path.join(pathToContent, file), {
            isIntentFile: true,
          });
        }
      }
    }
    let sum: number = 0;
    // calculate uncompressed output file size
    for (const content of await fs.promises.readdir(OUTPUT_PATH)) {
      const pathTo = path.join(OUTPUT_PATH, content);
      const stats = await fs.promises.stat(pathTo);
      if (stats.isFile()) {
        sum += stats.size;
      } else if (stats.isDirectory()) {
        // for each file in this directory, find its size and add it to the total
        for (const file of (await fs.promises.readdir(pathTo)).filter(
          async (dirContent: any) =>
            (await fs.promises.stat(path.join(pathTo, dirContent))).isFile()
        )) {
          sum += (await fs.promises.stat(path.join(pathTo, file))).size;
        }
      }
    }
    console.info(
      `done.${os.EOL}wrote ${sum / 1000}kB to ${__dirname}${
        path.sep
      }${path.basename(OUTPUT_PATH)}.`
    );
  })();
} catch (err) {
  console.error(err);
  process.exit(1);
}

// copies file to its destination in the output directory
async function copyFileToOutput(pathToFile, options = { isIntentFile: false }) {
  const pathToOutput = path.join(
    __dirname,
    "output",
    options.isIntentFile ? "intents" : "",
    path.basename(pathToFile)
  );
  return await fs.promises.copyFile(pathToFile, pathToOutput);
}
