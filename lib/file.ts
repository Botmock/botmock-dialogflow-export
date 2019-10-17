import { join } from "path";
import { EOL } from "os";
import { uuid4 } from "@sentry/utils";
import * as flow from "@botmock-api/flow";
import { default as findPlatformEntity } from "@botmock-api/entity-map";
import { writeJson, readFile } from "fs-extra";
import { default as BoardBoss } from "./board";
import { default as TextTransformer } from "./text";
import { default as PlatformProvider } from "./providers";
import * as Dialogflow from "./types";

interface Config {
  readonly outputDirectory: string;
  readonly projectData: any;
}

export default class FileWriter extends flow.AbstractProject {
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
   * @returns Dialogflow.InputContext[]
   * @todo
   */
  private getInputContextsForIntent(intentId: string): Dialogflow.InputContext[] {
    return [];
  }
  /**
   * Gets array of output context for a given intent
   * @param intentId string
   * @returns Dialogflow.OutputContext[]
   */
  private getOutputContextsForIntent(intentId: string): Dialogflow.OutputContext[] {
    const connectedMessagesCreatingIntents = this.getMessagesForIntent(intentId)
      .filter((message: flow.Message) => {
        return message.next_message_ids.some((nextMessage: flow.NextMessage) => (
          typeof nextMessage.intent !== "string"
        ));
      });
    return connectedMessagesCreatingIntents.map((message: flow.Message) => ({
      name: message.payload.nodeName,
      parameters: {},
      lifespan: 1,
    }));
  }
  /**
   * Gets array of parameters for a given intent
   * @param intentId string
   * @returns Dialogflow.Parameter[]
   */
  private getParametersForIntent(intentId: string): Dialogflow.Parameter[] {
    const { utterances, slots } = this.getIntent(intentId) as flow.Intent;
    return this.text.getUniqueVariablesInUtterances(utterances)
      .map((variableName: string) => {
        const { id, name, default_value: value, entity } = this.projectData.variables.find(variable => (
          variable.name === variableName
        ));
        let dataType: string;
        try {
          dataType = findPlatformEntity(entity, { platform: "dialogflow" }) as string;
        } catch (_) {
          const { name } = this.projectData.entities.find(customEntity => customEntity.id === entity) as any;
          dataType = `@${this.sanitizeEntityName(name)}`;
        }
        return {
          id,
          required: false,
          dataType,
          name,
          value: `$${value || name}`,
          promptMessages: [],
          noMatchPromptMessages: [],
          noInputPromptMessages: [],
          outputDialogContexts: [],
          isList: false,
        }
      });
  }
  /**
   * Gets array of messages to serve as responses for an intent id
   * @param intentId string
   * @returns flow.Message[]
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
   * Removes forbidden characters from custom entity name
   * @param name string
   * @returns string
   */
  private sanitizeEntityName(name: string): string {
    return name.replace(/\s/g, "").toLowerCase();
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
      const entityNameWithoutForbiddenCharaters = this.sanitizeEntityName(name);
      const entityData = {
        id,
        name: entityNameWithoutForbiddenCharaters,
        isOverridable: true,
        isEnum: false,
        isRegexp: false,
        automatedExpansion: false,
        allowFuzzyExtraction: false
      };
      const pathToEntities = join(this.outputDirectory, "entities");
      await writeJson(join(pathToEntities, `${entityNameWithoutForbiddenCharaters}.json`), entityData, { EOL, spaces: 2});
      await writeJson(join(pathToEntities, `${entityNameWithoutForbiddenCharaters}_entries_en.json`), entityEntries, { EOL, spaces: 2 });
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
            parameters: this.getParametersForIntent(intentId),
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
        // @ts-ignore
        files: []
      }
    };
  }
}
