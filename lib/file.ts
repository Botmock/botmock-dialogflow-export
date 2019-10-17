import { join } from "path";
import { EOL } from "os";
import { uuid4 } from "@sentry/utils";
import * as flow from "@botmock-api/flow";
// import { default as findPlatformEntity } from "@botmock-api/entity-map";
import { writeJson, readFile } from "fs-extra";
import { default as BoardBoss } from "./board";
import { default as TextTransformer } from "./text";
import { default as PlatformProvider } from "./providers";

interface Config {
  readonly outputDirectory: string;
  readonly projectData: any;
}

export default class FileWriter extends flow.AbstractProject {
  static defaultWelcomeIntent: any = {};
  static supportedPlatforms = new Set([
    "facebook",
    "slack",
    "skype",
    "google",
  ]);
  static delimiter = ".";
  private readonly templateDirectory: string;
  private readonly outputDirectory: string;
  private readonly text: TextTransformer;
  private readonly board: BoardBoss;
  private readonly boardStructureByIntents: flow.SegmentizedStructure;
  /**
   * Creates new instance of FileWriter class
   * @param config Config object containing outputDirectory and projectData
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.outputDirectory = config.outputDirectory;
    this.templateDirectory = join(process.cwd(), "templates");
    this.boardStructureByIntents = this.segmentizeBoardFromIntents();
    this.text = new TextTransformer({});
    this.board = new BoardBoss({
      projectData: config.projectData,
      board: this.projectData.board.board,
      boardStructureByIntents: this.boardStructureByIntents
    });
  }
  /**
   * Gets array of required input context for a given intent
   * @param intentId string
   * @returns string[]
   * @todo
   */
  private getInputContextsForIntent(intentId: string): string[] {
    return [];
  }
  /**
   * Gets array of output context for a given intent
   * @param intentId string
   * @returns object[]
   * @todo
   */
  private getOutputContextsForIntent(intentId: string): object[] {
    // const nextMessages = this.getMessagesForIntent(intentId);
    return [];
  }
  /**
   * Gets array of messages to serve as responses for an intent id
   * @param intentId string
   * @returns flow.Message[]
   * @todo
   */
  private getMessagesForIntent(intentId: string): flow.Message[] {
    return this.boardStructureByIntents.get(intentId)
      .map((messageId: string) => {
        const message = this.getMessage(messageId) as flow.Message;
        return this.board.findMessagesUpToNextIntent(message);
      })
      .reduce((acc, group) => {
        return [...acc, ...group];
      }, []);
  }
  /**
   * Gets array of events for an intent id
   * @param intentId string
   * @returns string[]
   */
  private getEventsForIntent(intentId: string): string[] {
    return [];
  }
  /**
   * Writes files that contain agent meta data
   * @returns Promise<void>
   */
  private async writeMeta(): Promise<void> {
    const packageData = { version: "1.0.0" };
    const agentData = JSON.parse(await readFile(join(this.templateDirectory, "meta", "agent.json"), "utf8"));
    await writeJson(join(this.outputDirectory, "package.json"), packageData, { EOL, spaces: 2 });
    await writeJson(join(this.outputDirectory, "agent.json"), agentData, { EOL, spaces: 2 });
  }
  /**
   * Writes files that contain entities
   * @returns Promise<void>
   */
  private async writeEntities(): Promise<void> {
    for (const { id, name, data: entityEntries } of this.projectData.entities) {
      const entityData = {
        id,
        name,
        isOverridable: true,
        isEnum: false,
        isRegexp: false,
        automatedExpansion: false,
        allowFuzzyExtraction: false
      };
      const pathToEntities = join(this.outputDirectory, "entities");
      await writeJson(join(pathToEntities, `${name}.json`), entityData, { EOL, spaces: 2});
      await writeJson(join(pathToEntities, `${name}_entries_en.json`), entityEntries, { EOL, spaces: 2 });
    }
  }
  /**
   * Writes intent files and utterance files
   * @returns Promise<void>
   */
  private async writeIntents(): Promise<void> {
    const platform = this.projectData.project.platform.toLowerCase();
    const platformProvider = new PlatformProvider(platform);
    for (const [intentId, messageIds] of this.boardStructureByIntents.entries()) {
      const { name } = this.getIntent(intentId) as flow.Intent;
      const inputContexts = this.getInputContextsForIntent(intentId);
      const intentData = {
        id: intentId,
        name,
        auto: true,
        contexts: inputContexts,
        responses: [
          {
            resetContexts: false,
            affectedContexts: this.getOutputContextsForIntent(intentId),
            parameters: {},
            messages: this.getMessagesForIntent(intentId).map(message => (
              platformProvider.create(message.message_type, message.payload)
            )),
            defaultResponsePlatforms: FileWriter.supportedPlatforms.has(platform)
              ? { [platform]: true }
              : {},
            speech: []
          }
        ],
        priority: 500000,
        webhookUsed: false,
        webhookForSlotFilling: false,
        fallbackIntent: false,
        events: this.getEventsForIntent(intentId),
        conditionalResponses: [],
        condition: "",
        conditionalFollowupEvents: []
      };
      const utteranceData = (this.getIntent(intentId) as flow.Intent)
        .utterances
        .map(utterance => {
          const data = [{
            text: utterance.text,
            userDefined: false
          }];
          return {
            id: uuid4(),
            data,
            isTemplate: false,
            count: 0,
            updated: 0
          }
        });
      const pathToIntents = join(this.outputDirectory, "intents");
      const intentName = this.text.truncateBasename(inputContexts.join(FileWriter.delimiter) + uuid4());
      await writeJson(join(pathToIntents, `${intentName}.json`), intentData, { EOL, spaces: 2 });
      await writeJson(join(pathToIntents, `${intentName}_usersays_en.json`), utteranceData, { EOL, spaces: 2 });
    }
  }
  /**
   * Writes necessary files to output directory
   * @returns Promise<{ data: any }>
   */
  public async write(): Promise<{ data: any }> {
    await this.writeMeta();
    await this.writeEntities();
    await this.writeIntents();
    return {
      data: {
        filesWritten: 0
      }
    };
  }
}
