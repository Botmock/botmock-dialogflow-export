import "dotenv/config";
import { createIntentMap, createMessageCollector } from "@botmock-api/utils";
import { remove } from "fs-extra";
import mkdirp from "mkdirp";
import Sema from "async-sema";
import uuid from "uuid/v4";
import os from "os";
import path from "path";
import util from "util";
import fs, { Stats } from "fs";
import BoardExplorer from "./lib/util/BoardExplorer";
import { getProjectData } from "./lib/util/client";
import { Provider } from "./lib/providers";
import { getArgs, templates, ZIP_PATH, SUPPORTED_PLATFORMS } from "./lib/util";

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
  throw new Error("this script requires node.js version 10.16.0 or greater");
}

let semaphore;
try {
  const OUTPUT_PATH = path.join(__dirname, process.argv[2] || "output");
  const INTENT_PATH = path.join(OUTPUT_PATH, "intents");
  const ENTITY_PATH = path.join(OUTPUT_PATH, "entities");
  (async () => {
    // remove any preexisting output
    await remove(OUTPUT_PATH);
    await util.promisify(mkdirp)(INTENT_PATH);
    await util.promisify(mkdirp)(ENTITY_PATH);
    // fetch project data via the botmock api
    const project: any = await getProjectData({
      projectId: process.env.BOTMOCK_PROJECT_ID,
      boardId: process.env.BOTMOCK_BOARD_ID,
      teamId: process.env.BOTMOCK_TEAM_ID,
      token: process.env.BOTMOCK_TOKEN,
    });
    // throw in the case of any errors returned from the api request
    for (const { error } of project.errors) {
      throw new Error(error);
    }
    let [intents, entities, board, { platform }] = project.data;
    if (platform === "google-actions") {
      platform = "google";
    }
    // create map of message ids to ids of intents connected to them
    const intentMap = createIntentMap(board.messages, intents);
    // create instance of semaphore class to control write concurrency
    semaphore = new Sema(os.cpus().length, { capacity: intentMap.size });
    // create instance of class that maps the board payload to dialogflow format
    (async () => {
      const provider = new Provider(platform);
      const explorer = new BoardExplorer({ board, intentMap });
      // from next messages, collects all reachable nodes not connected by intents
      const collectIntermediateNodes = createMessageCollector(
        intentMap,
        explorer.getMessageFromId.bind(explorer)
      );
      // set a welcome-like intent if no intent from the root is defined
      if (!intentMap.size || explorer.isMissingWelcomeIntent(board.messages)) {
        const { next_message_ids } = board.messages.find(
          explorer.messageIsRoot.bind(explorer)
        );
        const [{ message_id: firstNodeId }] = next_message_ids;
        intentMap.set(firstNodeId, [uuid()]);
      }
      // write intent and utterances files for each combination of (message, intent)
      for (const [key, intentIds] of intentMap.entries()) {
        await semaphore.acquire();
        const {
          message_type,
          payload,
          message_id,
          next_message_ids,
          previous_message_ids,
        } = explorer.getMessageFromId(key);
        for (const intentId of intentIds) {
          const { name, updated_at, utterances }: any = intents.find(
            i => i.id === intentId
          ) || {
            name: "welcome",
            updated_at: Date.now(),
            utterances: [],
          };
          const basename = `${payload.nodeName}(${message_id})_${name}`;
          const filePath = `${INTENT_PATH}/${basename}.json`;
          // group together the nodes that do not create intents
          const intermediateNodes = collectIntermediateNodes(
            next_message_ids
          ).map(explorer.getMessageFromId.bind(explorer));
          const getNameOfIntent = (value: string) => {
            const { name: intentName }: any =
              intents.find(i => i.id === intentId) || {};
            return intentName;
          };
          await fs.promises.writeFile(
            filePath,
            JSON.stringify({
              ...templates.intent,
              id: uuid(),
              name: basename,
              contexts: explorer.hasWelcomeIntent(key)
                ? []
                : [getNameOfIntent(intentId)],
              events: explorer.hasWelcomeIntent(key)
                ? [{ name: "WELCOME" }]
                : [],
              lastUpdate: Date.parse(updated_at.date),
              responses: [
                {
                  action: "",
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
                            name: getNameOfIntent(value),
                            parameters: {},
                            lifespan: 1,
                          })),
                      ];
                    }, []),
                    ...next_message_ids
                      .filter(({ intent }) => !!intent.value)
                      .map(({ intent: { value } }) => ({
                        name: getNameOfIntent(value),
                        parameters: {},
                        lifespan: 1,
                      })),
                  ],
                  defaultResponsePlatforms: SUPPORTED_PLATFORMS.has(
                    platform.toLowerCase()
                  )
                    ? { [platform.toLowerCase()]: true }
                    : {},
                  messages: [{ message_type, payload }, ...intermediateNodes]
                    .map(message =>
                      provider.create(message.message_type, message.payload)
                    )
                    // sort to abide by dialogflow's rule that chat bubbles come before cards
                    .sort((a, b) => a.type.length - b.type.length)
                    // abide by dialogflow's response limiting
                    .reduce((acc, message) => {
                      // console.log(message);
                      return [...acc];
                    }, []),
                },
              ],
            })
          );
          if (Array.isArray(utterances) && utterances.length) {
            // write utterance file
            await fs.promises.writeFile(
              `${filePath.slice(0, -5)}_usersays_en.json`,
              JSON.stringify(
                utterances.map(utterance => {
                  const data = [];
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
                  for (const [id, [start, end]] of Object.entries(pairs)) {
                    const previousBlock = [];
                    if (start !== lastIndex) {
                      previousBlock.push({
                        text: utterance.text.slice(lastIndex, start),
                        userDefined: false,
                      });
                    }
                    const { name, entity } = utterance.variables.find(
                      vari => vari.id === id
                    );
                    data.push(
                      ...previousBlock.concat({
                        text: name.slice(1, -1),
                        meta: `@${entity}`,
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
                })
              )
            );
          }
        }
        semaphore.release();
      }
    })();
    // write entity files in one-to-one correspondence with project
    for (const entity of entities) {
      const pathToEntityFile = path.join(ENTITY_PATH, `${entity.name}.json`);
      await fs.promises.writeFile(
        pathToEntityFile,
        JSON.stringify({
          ...templates.entity,
          id: uuid(),
          name: entity.name,
        })
      );
      const pathToEntityEntriesFile = path.join(
        ENTITY_PATH,
        `${entity.name}_entries_en.json`
      );
      await fs.promises.writeFile(
        pathToEntityEntriesFile,
        JSON.stringify(entity.data)
      );
    }
    // copies file to its destination in the output directory
    async function copyFileToOutput(
      pathToFile,
      options = { isIntentFile: false }
    ) {
      const pathToOutput = path.join(
        __dirname,
        "output",
        options.isIntentFile ? "intents" : "",
        path.basename(pathToFile)
      );
      return await fs.promises.copyFile(pathToFile, pathToOutput);
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
    console.log(
      `Completed writing to ${path.sep}${path.basename(OUTPUT_PATH)} (${sum /
        1000}kB)`
    );
  })();
} catch (err) {
  if (semaphore && semaphore.nrWaiting() > 0) {
    semaphore.drain().then(() => {
      process.exit(1);
    });
  } else {
    console.error(err);
    process.exit(1);
  }
}
