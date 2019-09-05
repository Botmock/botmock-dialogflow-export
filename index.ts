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
import crypto from "crypto";
import fs, { Stats } from "fs";
import BoardExplorer from "./lib/util/BoardExplorer";
import { Provider } from "./lib/providers";
import { getProjectData } from "./lib/util/client";
import { writeUtterancesFile, copyFileToOutput } from "./lib/util/write";
import { getArgs, templates, supportedPlatforms } from "./lib/util";
import {
  Intent,
  InputContext,
  OutputContext,
  ProjectResponse,
  Message,
} from "./lib/types";

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
  // check that the node version is above the minimum
  assert.strictEqual(numericalNodeVersion >= MIN_NODE_VERSION, true);
} catch (_) {
  throw "requires node.js version 10.16.0 or greater";
}

function truncateBasename(name: string = ""): string {
  const CHARACTER_LIMIT = 100;
  const diff = CHARACTER_LIMIT - name.length;
  // if the name length exceeds the limit, replace the number of characters
  // by which the name exceeds the limit with random bytes to avoid file
  // name collisions for similar paths
  if (Object.is(Math.sign(diff), -1)) {
    const absDiff = Math.abs(diff);
    const randomBytes = crypto.randomBytes(CHARACTER_LIMIT).toString("hex");
    return name
      .slice(absDiff + Math.floor(CHARACTER_LIMIT / 2))
      .padStart(CHARACTER_LIMIT, randomBytes);
  }
  return name;
}

// find the unique variables referenced in an utterance by reducing
// on the variables, with variable names as keys
function getUniqueVariablesInUtterances(utterances: any[]): any[] {
  return Object.keys(
    utterances
      .filter(utterance => !!utterance.variables.length)
      .reduce(
        (acc, utterance) => ({
          ...acc,
          ...utterance.variables.reduce(
            (acc, variable) => ({
              ...acc,
              [variable.name.replace(/%/g, "")]: variable,
            }),
            {}
          ),
        }),
        {}
      )
  );
}

function replaceVariableSignInText(text: string = ""): string {
  let str = text;
  const variableRegex = /%[a-zA-Z0-9]+%/g;
  const matches = text.match(variableRegex);
  // if this text contains at least one variable, replace all
  // occurrences of it with the correct output variable sign
  if (!Object.is(matches, null)) {
    for (const match of matches) {
      const indexOfMatch = text.search(variableRegex);
      str =
        str.slice(0, indexOfMatch) +
        "$" +
        match.slice(1, match.length - 1) +
        str.slice(indexOfMatch + match.length);
    }
  }
  return str;
}

let semaphore: void | Sema;
let shouldUseDefaultWelcomeIntent = true;
const INTENT_NAME_DELIMITER = process.env.INTENT_NAME_DELIMITER || "-";
const INTENT_PATH = path.join(OUTPUT_PATH, "intents");
const ENTITY_PATH = path.join(OUTPUT_PATH, "entities");

try {
  (async () => {
    const defaultIntent = {
      name: "welcome",
      updated_at: Date.now(),
      // merge in utterances of default dialogflow welcome intent
      utterances: JSON.parse(
        await fs.promises.readFile(
          path.join(
            "templates",
            "defaults",
            "Default Welcome Intent_usersays_en.json"
          ),
          "utf8"
        )
      ).map((utterance: any) => {
        const [{ text }] = utterance.data;
        return { text, variables: [] };
      }),
    };
    // recreate output directories
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
    // create mapping of message id, intent ids connected to it
    const intentMap = createIntentMap(board.messages, intents);
    const explorer = new BoardExplorer({ board, intentMap });
    // create function that groups messages not connected by any intent
    const collectIntermediateMessages: any = createMessageCollector(
      intentMap,
      explorer.getMessageFromId.bind(explorer)
    );
    // get the name of an intent from its id
    const getIntentName = (id: string): string => {
      const intent: Intent = intents.find(intent => intent.id === id) || {};
      return intent.name || "";
    };
    // find the input context implied by a given message id
    const getInputContextFromMessage = (
      immediateMessageId: string
    ): InputContext => {
      const context: string[] = [];
      const seenIds: string[] = [];
      // recurse on a message id to fill in context
      (function unwindFromMessageId(messageId: string): void {
        const { previous_message_ids } = explorer.getMessageFromId(messageId);
        let messageFollowingIntent;
        if (
          (messageFollowingIntent = previous_message_ids.find(
            ({ message_id }) => intentMap.get(message_id)
          ))
        ) {
          const intentName = getIntentName(
            intentMap.get(messageFollowingIntent.message_id)[0]
          );
          if (typeof intentName !== "undefined") {
            context.push(intentName);
          }
        } else {
          for (const { message_id } of previous_message_ids) {
            if (!seenIds.includes(messageId)) {
              seenIds.push(messageId);
              unwindFromMessageId(messageId);
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
        projectName.slice(0, 10) +
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
      return str.toLowerCase().replace(/\s/gi, INTENT_NAME_DELIMITER);
    };
    // map a message to proper output context object
    const createOutputContextFromMessage = (
      message: Message
    ): OutputContext => ({
      name: getIntentName(message.intent.value),
      parameters: {},
      lifespan: 1,
    });
    // pair output context of those intermediate messages that create
    // intents with those next messages that directly follow intents
    const getAffectedContexts = (
      intermediateMessages: Message[],
      nextMessageIds: any[]
    ): OutputContext[] => [
      ...intermediateMessages.reduce((acc, { next_message_ids = [] }) => {
        if (!next_message_ids.length) {
          return acc;
        }
        return [
          ...acc,
          ...next_message_ids
            .filter(
              nextMessage =>
                !!intents.find(intent => intent.id === nextMessage.intent.value)
            )
            .map(createOutputContextFromMessage),
        ];
      }, []),
      ...nextMessageIds
        .filter(
          nextMessage =>
            typeof nextMessage.intent !== "string" && nextMessage.intent.value
        )
        .map(createOutputContextFromMessage),
    ];
    // if no intent from the root is defined set a welcome-like intent
    if (!intentMap.size || explorer.isMissingWelcomeIntent(board.messages)) {
      const { next_message_ids } = board.messages.find(
        explorer.messageIsRoot.bind(explorer)
      );
      const [{ message_id: firstNodeId }] = next_message_ids;
      intentMap.set(firstNodeId, [uuid()]);
      shouldUseDefaultWelcomeIntent = false;
    }
    // create instance of semaphore class to control write concurrency
    semaphore = new Sema(os.cpus().length, { capacity: intentMap.size || 1 });
    // create instance of response writing class
    const provider = new Provider(platform);
    // for each intent-message, iterate over intents connected to this message and write files
    for (const [messageId, intentIds] of intentMap.entries()) {
      const {
        message_type,
        payload,
        message_id,
        next_message_ids,
        previous_message_ids,
      } = explorer.getMessageFromId(messageId);
      for (const connectedIntentId of intentIds) {
        await semaphore.acquire();
        try {
          let name = getIntentName(connectedIntentId);
          if (typeof name === "undefined") {
            const uniqueName = uuid();
            console.warn(
              `${os.EOL}found unnamed intent. ${os.EOL}using name ${uniqueName}${os.EOL}`
            );
            name = uniqueName;
          }
          const contexts = [
            ...getInputContextFromMessage(messageId),
            ...(typeof name !== "undefined" ? [name] : []),
          ];
          const basename = truncateBasename(
            getIntentFileBasename(contexts, payload.nodeName.replace(/\//g, ""))
          );
          const filePath = path.join(INTENT_PATH, `${basename}.json`);
          const intermediateMessages = collectIntermediateMessages(
            next_message_ids
          ).map(explorer.getMessageFromId.bind(explorer));
          // affectedContexts should be the union of input contexts and any
          // intents reachable from messages in the intermediate cluster
          const affectedContexts = [
            ...contexts.map(name => ({
              name,
              parameters: {},
              lifespan: 1,
            })),
            ...getAffectedContexts(intermediateMessages, next_message_ids),
          ];
          const { utterances, updated_at, ...rest }: Partial<Intent> =
            intents.find(intent => intent.id === connectedIntentId) ||
            defaultIntent;
          const uniqueVariables = getUniqueVariablesInUtterances(utterances);
          await writeUtterancesFile(filePath, utterances, updated_at, entities);
          await fs.promises.writeFile(
            filePath,
            JSON.stringify(
              {
                ...templates.intent,
                id: uuid(),
                name: basename,
                contexts: explorer.hasWelcomeIntent(message_id) ? [] : contexts,
                events: explorer.hasWelcomeIntent(messageId)
                  ? [{ name: "WELCOME" }]
                  : [],
                lastUpdate: Date.parse(updated_at.date),
                responses: [
                  {
                    action: uniqueVariables.length
                      ? `action.${uniqueVariables[0]}`
                      : "",
                    parameters: uniqueVariables.map(name => ({
                      id: uuid(),
                      required: false,
                      dataType: "@sys.any",
                      name,
                      value: `$${name}`,
                      promptMessages: [],
                      noMatchPromptMessages: [],
                      noInputPromptMessages: [],
                      outputDialogContexts: [],
                      isList: false,
                    })),
                    speech: [],
                    resetContexts: false,
                    affectedContexts,
                    defaultResponsePlatforms: supportedPlatforms.has(
                      platform.toLowerCase()
                    )
                      ? { [platform.toLowerCase()]: true }
                      : {},
                    messages: [
                      { message_type, payload },
                      ...intermediateMessages,
                    ]
                      .map(message => ({
                        ...message,
                        payload: {
                          ...message.payload,
                          text: replaceVariableSignInText(message.payload.text),
                        },
                      }))
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
        JSON.stringify(
          {
            ...templates.entity,
            id: uuid(),
            name: entity.name,
          },
          null,
          2
        ) + os.EOL
      );
      await fs.promises.writeFile(
        path.join(ENTITY_PATH, `${entity.name}_entries_en.json`),
        JSON.stringify(entity.data, null, 2) + os.EOL
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
          if (!shouldUseDefaultWelcomeIntent && file.includes("Welcome")) {
            continue;
          }
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
