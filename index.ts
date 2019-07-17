import "dotenv/config";
import { createIntentMap, createMessageCollector } from "@botmock-api/utils";
import { remove } from "fs-extra";
import { Sema } from "async-sema";
import mkdirp from "mkdirp";
import uuid from "uuid/v4";
import os from "os";
import path from "path";
import util from "util";
import assert from "assert";
import fs, { Stats } from "fs";
import BoardExplorer from "./lib/util/BoardExplorer";
import { getProjectData } from "./lib/util/client";
import { Provider } from "./lib/providers";
import { writeUtterancesFile, copyFileToOutput } from "./lib/util/write";
import { getArgs, templates, ZIP_PATH, SUPPORTED_PLATFORMS } from "./lib/util";

type Intent = {
  name: string;
  updated_at: { date: string };
  utterances: { text: string; variables: any[] }[];
};

type InputContext = string[];
type OutputContext = { name: string | void; parameters: {}; lifespan: number };

type ProjectResponse = Readonly<{
  data?: any[];
  errors?: any[];
}>;

export type Message = {
  message_id: string;
  next_message_ids: any[];
  previous_message_ids: any[];
  message_type: string;
  intent: { value: string };
  payload: any;
};

export const OUTPUT_PATH = path.join(
  process.cwd(),
  process.env.OUTPUT_DIR || "output"
);

try {
  const MIN_NODE_VERSION = 101600;
  const numericalNodeVersion = parseInt(
    process.version
      .slice(1)
      .split(".")
      .map(seq => seq.padStart(2, "0"))
      .join(""),
    10
  );
  assert.strictEqual(numericalNodeVersion >= MIN_NODE_VERSION, true);
} catch (_) {
  throw "requires node.js version 10.16.0 or greater";
}

let semaphore: void | Sema;
try {
  const INTENT_NAME_DELIMITER = process.env.INTENT_NAME_DELIMITER || "-";
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
    let [
      intents,
      entities,
      board,
      { platform, name: projectName },
    ] = project.data;
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
      const { name: intentName }: Intent =
        intents.find(intent => intent.id === id) || {};
      return intentName;
    };
    // find the context that is implied by a given message id that follows from
    // an intent by unwinding its intent history and returning this history as
    // an array of strings
    const getRequiredContext = (immediateMessageId: string): InputContext => {
      const context: string[] = [];
      // keep adding to context by searching previous messages for message ids
      // that follow from intents until more than one such previous message exists
      (function unwindFromMessageId(id: string, stack: string[] = []): void {
        const { previous_message_ids } = explorer.getMessageFromId(id);
        for (const { message_id: previousId } of previous_message_ids) {
          if (!intentMap.get(previousId) && !stack.includes(previousId)) {
            unwindFromMessageId(previousId, [...stack, previousId]);
          } else if (intentMap.get(previousId)) {
            const [firstIntent, ...otherIntents] = intentMap.get(previousId);
            if (otherIntents.length) {
              return;
            }
            const name = getNameOfIntent(firstIntent);
            if (typeof name !== "undefined" && context.slice(-1)[0] !== name) {
              context.push(name);
            }
          }
        }
      })(immediateMessageId);
      return context;
    };
    const uniqueNameMap = new Map<string, number>();
    // construct intent file name based on project name and input context
    const getIntentFileBasename = (
      contexts: InputContext,
      messageName: string
    ): string => {
      let str =
        projectName +
        (contexts.length ? INTENT_NAME_DELIMITER : "") +
        contexts.join(INTENT_NAME_DELIMITER) +
        INTENT_NAME_DELIMITER +
        messageName;
      if (uniqueNameMap.get(messageName)) {
        const i = str.lastIndexOf(INTENT_NAME_DELIMITER);
        str =
          str.slice(0, i) +
          INTENT_NAME_DELIMITER +
          messageName +
          uniqueNameMap.get(messageName);
        uniqueNameMap.set(messageName, uniqueNameMap.get(messageName) + 1);
      } else {
        uniqueNameMap.set(messageName, 1);
      }
      return str.toLowerCase();
    };
    // map a message to proper output context object
    const createOutputContextFromMessage = (
      message: Message
    ): OutputContext => ({
      name: getNameOfIntent(message.intent.value),
      parameters: {},
      lifespan: 1,
    });
    const getAffectedContexts = (
      intermediateMessages: Message[],
      nextMessageIds: any[]
    ): OutputContext[] => [
      ...intermediateMessages.reduce((acc, { next_message_ids }) => {
        if (!next_message_ids.length) {
          return acc;
        }
        return [
          ...acc,
          ...next_message_ids
            .filter(({ intent }) => !!intent.value)
            .map(createOutputContextFromMessage),
        ];
      }, []),
      ...nextMessageIds
        .filter(({ intent }) => !!intent.value)
        .map(createOutputContextFromMessage),
    ];
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
    // for each message in the intent map..
    for (const [messageId, intentIds] of intentMap.entries()) {
      const {
        message_type,
        payload,
        message_id,
        next_message_ids,
        previous_message_ids,
      } = explorer.getMessageFromId(messageId);
      // ..iterate over each intent id on it and write intent and utterance files
      for (const intentId of intentIds) {
        await semaphore.acquire();
        try {
          // console.info(semaphore.nrWaiting());
          const { updated_at, utterances, ...rest }: Partial<Intent> =
            intents.find(intent => intent.id === intentId) || DEFAULT_INTENT;
          const contexts = getRequiredContext(messageId);
          const basename = getIntentFileBasename(contexts, payload.nodeName);
          const filePath = path.join(INTENT_PATH, `${basename}.json`);
          const intermediateMessages = collectIntermediateMessages(
            next_message_ids
          ).map(explorer.getMessageFromId.bind(explorer));
          const affectedContexts = getAffectedContexts(
            intermediateMessages,
            next_message_ids
          );
          await writeUtterancesFile(filePath, utterances, updated_at, entities);
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
                    affectedContexts,
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
