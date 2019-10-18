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
  static welcomeIntentName = "Default Welcome Intent";
  static fallbackIntentName = "Default Fallback Intent";
  private readonly templateDirectory: string;
  private readonly outputDirectory: string;
  private readonly pathToIntents: string;
  private readonly text: TextTransformer;
  private readonly board: BoardBoss;
  private readonly firstMessage: flow.Message;
  private boardStructureByMessages: flow.SegmentizedStructure;
  /**
   * Creates new instance of FileWriter class
   * 
   * @remarks sets artifical intent between root message and only connected
   * message for the sake of establishing a welcome intent
   * 
   * @param config Config object containing outputDirectory and projectData
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.outputDirectory = config.outputDirectory;
    this.templateDirectory = join(process.cwd(), "templates");
    this.pathToIntents = join(this.outputDirectory, "intents")
    this.boardStructureByMessages = this.segmentizeBoardFromMessages();
    this.text = new TextTransformer({});
    this.board = new BoardBoss({
      projectData: config.projectData,
      board: this.projectData.board.board,
      boardStructureByMessages: this.boardStructureByMessages
    });
    if (!this.board.containsWelcomeIntent()) {
      const [idOfRootMessage] = this.projectData.board.board.root_messages;
      const rootMessage = this.board.getMessage(idOfRootMessage) as flow.Message;
      const [firstMessage] = rootMessage.next_message_ids as flow.NextMessage[];
      this.firstMessage = firstMessage;
      // @ts-ignore
      this.boardStructureByMessages.set(firstMessage.message_id, uuid4());
    }
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
    const connectedMessagesCreatingIntents = this.getMessagesForMessage(intentId)
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
   * Gets array of messages connected to message id without any intent
   * @param messageId string
   * @returns flow.Message[]
   * @todo
   */
  private getMessagesForMessage(messageId: string): flow.Message[] {
    const message = this.board.getMessage(messageId);
    if (typeof message !== "undefined") {
      return this.board.findMessagesUpToNextIntent(message);
    }
    return [];
  }
  /**
   * Gets array of events for an intent id
   * @param intentId string
   * @returns string[]
   * @todo
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
   * Writes intent files for artifically inserted intent between root message and first message
   * @param providerInstance PlatformProvider
   * @returns Promise<void>
   */
  private async writePseudoWelcomeIntent(providerInstance: PlatformProvider): Promise<void> {
    const pathToTemplates = join(this.templateDirectory, "defaults");
    const { welcomeIntentName } = FileWriter;
    const intentData = JSON.parse(await readFile(join(pathToTemplates, `${welcomeIntentName}.json`), "utf8"));
    intentData.responses[0].messages = this.getMessagesForMessage(this.firstMessage.message_id)
      .map(message => (
        providerInstance.create(message.message_type, message.payload)
      ));
    const utteranceData = JSON.parse(await readFile(join(pathToTemplates, `${welcomeIntentName}_usersays_en.json`), "utf8"));
    await writeJson(join(this.pathToIntents, `${welcomeIntentName}.json`), intentData, { EOL, spaces: 2 });
    await writeJson(join(this.pathToIntents, `${welcomeIntentName}_usersays_en.json`), utteranceData, { EOL, spaces: 2 });
  }
  /**
   * Writes intent files and utterance files
   * 
   * @remarks Iterates over intent ids in terms of the message they are connected to
   * 
   * @returns Promise<void>
   */
  private async writeIntents(): Promise<void> {
    const platform = this.projectData.project.platform.toLowerCase();
    const platformProvider = new PlatformProvider(platform);
    const entriesOfSegmentizedBoard = this.boardStructureByMessages.entries();
    for (const [idOfConnectedMessage, idsOfConnectingIntents] of entriesOfSegmentizedBoard) {
      for (const id of idsOfConnectingIntents) {
        if (!this.getIntent(id)) {
          await this.writePseudoWelcomeIntent(platformProvider);
          continue;
        }
        const { name } = this.getIntent(id) as flow.Intent;
        const inputContexts = this.getInputContextsForIntent(id);
        const intentName = this.text.truncateBasename(inputContexts.join(FileWriter.delimiter) + name + uuid4());
        const intentData = {
          id,
          name: intentName,
          auto: true,
          contexts: inputContexts,
          responses: [
            {
              resetContexts: false,
              affectedContexts: this.getOutputContextsForIntent(id),
              parameters: this.getParametersForIntent(id),
              messages: this.getMessagesForMessage(idOfConnectedMessage).map(message => (
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
          events: this.getEventsForIntent(id),
          conditionalResponses: [],
          condition: "",
          conditionalFollowupEvents: []
        };
        const utteranceData = (this.getIntent(id) as flow.Intent)
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
        await writeJson(join(this.pathToIntents, `${intentName}.json`), intentData, { EOL, spaces: 2 });
        await writeJson(join(this.pathToIntents, `${intentName}_usersays_en.json`), utteranceData, { EOL, spaces: 2 });
      }
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
