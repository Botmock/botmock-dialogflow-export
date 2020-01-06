import { join } from "path";
import { EOL } from "os";
import { uuid4 } from "@sentry/utils";
import * as flow from "@botmock-api/flow";
import { default as findPlatformEntity } from "@botmock-api/entity-map";
import { writeJson, readFile } from "fs-extra";
import { default as BoardBoss } from "./board";
import { default as TextTransformer } from "./text";
import { default as PlatformProvider } from "./providers";

namespace Dialogflow {
  export type InputContext = string;
  export type OutputContext = {
    name: string | void;
    parameters: {};
    lifespan: number;
  };
  export type Parameter = {
    id: string;
    required: boolean;
    dataType: string;
    name: string;
    value: string;
    promptMessages: any[];
    noMatchPromptMessages: [];
    noInputPromptMessages: [];
    outputDialogContexts: [];
    isList: boolean;
  };
}

export type ProjectData<T> = T extends Promise<infer K> ? K : any;

interface Config {
  readonly outputDirectory: string;
  readonly projectData: ProjectData<unknown>;
}

export default class FileWriter extends flow.AbstractProject {
  static lifespan = 5;
  static delimiterCharacter = ".";
  static botmockVariableCharacter = "%";
  static welcomeIntentName = "Default Welcome Intent";
  static fallbackIntentName = "Default Fallback Intent";
  static defaultPriority = 500000;
  static supportedPlatforms = new Set([
    "facebook",
    "slack",
    "skype",
    "google",
  ]);
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
   * @remarks sets artificial intent between root message and first connected
   * message for the sake of establishing a welcome intent
   * 
   * @param config Config object containing outputDirectory and projectData
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.outputDirectory = config.outputDirectory;
    this.templateDirectory = join(process.cwd(), "templates");
    this.pathToIntents = join(this.outputDirectory, "intents");
    this.boardStructureByMessages = this.segmentizeBoardFromMessages();
    this.text = new TextTransformer();
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
      this.boardStructureByMessages.set(firstMessage.message_id, Array.of(uuid4()));
    }
  }
  /**
   * Gets array of input context for a given connected message id
   * @param messageId string
   */
  private getInputContextsForMessageConnectedByIntent(messageId: string): Dialogflow.InputContext[] {
    const self = this;
    const inputs: string[] = [];
    const seenPreviousMessageIds: string[] = [];
    const { previous_message_ids } = this.getMessage(messageId) as flow.Message;
    (function gatherDeterministicInputPath(previousMessages: flow.PreviousMessage[]): void {
      const previousMessagesConnectedByIntents = previousMessages.filter(message => (
        self.boardStructureByMessages.get(message.message_id)
      ));
      switch (previousMessagesConnectedByIntents.length) {
        case 1:
          const [previousMessageConnectedByIntent] = previousMessagesConnectedByIntents;
          const { message_id: messageId } = self.getMessage(previousMessageConnectedByIntent.message_id) as flow.Message;
          const intentsConnectedToPreviousMessage = self.boardStructureByMessages
            .get(messageId)
            .map(intentId => {
              const intent = self.getIntent(intentId);
              if (typeof intent !== "undefined") {
                return intent.name;
              } else {
                return null;
              }
            })
            .filter(intent => !Object.is(intent, null))
            .filter(intent => !inputs.includes(intent));
          inputs.push(...intentsConnectedToPreviousMessage);
          break;
        case 0:
          for (const previousMessage of previousMessages) {
            const fullPreviousMessage = self.getMessage(previousMessage.message_id) as flow.Message;
            seenPreviousMessageIds.push(...fullPreviousMessage.previous_message_ids.map(message => message.message_id));
            const hasNotSeenPreviousMessages = !seenPreviousMessageIds.find(id => (
              fullPreviousMessage.previous_message_ids.find(message => message.message_id === id)
            ));
            if (hasNotSeenPreviousMessages && typeof fullPreviousMessage.previous_message_ids !== "undefined") {
              gatherDeterministicInputPath(fullPreviousMessage.previous_message_ids);
            }
          }
        default:
          break;
      }
    })(previous_message_ids);
    return inputs;
  }
  /**
   * Gets array of output context for a given connected message id
   * @param messageId string
   */
  private getOutputContextsForMessageConnectedByIntent(messageId: string): Dialogflow.OutputContext[] {
    return this.getMessagesForMessage(messageId)
      .concat(Array.of(this.getMessage(messageId) as flow.Message))
      .filter(message => message.next_message_ids.some((nextMessage: flow.NextMessage) => (
        typeof nextMessage.intent !== "string"
      )))
      .reduce((acc, messageSettingIntent) => {
        return [
          ...acc,
          ...messageSettingIntent.next_message_ids
            .filter((nextMessage: flow.NextMessage) => (
              typeof nextMessage.intent !== "string"
            ))
            .map((nextMessage: flow.NextMessage) => {
              let name: string;
              if (typeof nextMessage.intent !== "string") {
                const { name: intentName }: any = this.getIntent(nextMessage.intent.value) ?? { name: "" };
                name = intentName;
              }
              const outputContextNameIsAlreadyAccumulated = acc.some((alreadyAddedObject: object) => (
                // @ts-ignore
                alreadyAddedObject.name === name
              ));
              if (outputContextNameIsAlreadyAccumulated) {
                return null;
              }
              return {
                name,
                parameters: {},
                lifespan: FileWriter.lifespan
              };
            })
            .filter(outputContextObject => !Object.is(outputContextObject, null))
        ];
      }, []);
  }
  /**
   * Gets array of parameters for a given intent
   * @param intentId string
   */
  private getParametersForIntent(intentId: string): Dialogflow.Parameter[] {
    const { utterances, slots } = this.getIntent(intentId) as flow.Intent;
    const requiredSlotsForIntent = slots.filter(slot => slot.is_required);
    return this.text.getUniqueVariablesInUtterances(utterances)
      .filter(variableName => typeof this.projectData.variables.find(variable => variable.name === variableName) !== "undefined")
      .map(variableName => {
        const { id, name, default_value: value, entity: entityId } = this.projectData.variables.find(variable => (
          variable.name === variableName
        ));
        const requiredSlot = requiredSlotsForIntent.find(slot => slot.variable_id === id);
        let dataType: string;
        try {
          dataType = findPlatformEntity(entityId, { platform: "dialogflow" }) as string;
        } catch (_) {
          const entity = this.projectData.entities.find(customEntity => customEntity.id === entityId);
          if (typeof entity !== "undefined") {
            dataType = `@${this.sanitizeEntityName(entity.name)}`;
          } else {
            dataType = "@sys.any";
          }
        }
        return {
          id,
          required: typeof requiredSlot !== "undefined",
          dataType,
          name: name.substr(0, 30).replace(/\s/g, ""),
          value: `$${value || name}`,
          promptMessages: typeof requiredSlot !== "undefined"
            ? Array.of(requiredSlot.prompt)
            : [],
          noMatchPromptMessages: [],
          noInputPromptMessages: [],
          outputDialogContexts: [],
          isList: false,
        };
      });
  }
  /**
   * Gets array of messages connected to message id without any intent
   * @param messageId string
   */
  private getMessagesForMessage(messageId: string): flow.Message[] {
    const message = this.board.getMessage(messageId);
    if (typeof message !== "undefined") {
      return this.gatherMessagesUpToNextIntent(message);
    }
    return [];
  }
  /**
   * Gets numerical priority for intent based on entity types found in its utterances
   * @param intentId string
   * @returns number
   */
  private getPriorityForIntent(intentId: string): number {
    const { defaultPriority } = FileWriter;
    const parameters = this.getParametersForIntent(intentId);
    if (parameters.some(parameter => parameter.dataType === "@sys.any")) {
      return 250000;
    }
    return defaultPriority;
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
   * Creates filename for an intent based on its input context and id
   * @param inputContexts string[]
   * @param idOfConnectedIntent string
   */
  private createFilenameForIntent(inputContexts: string[], idOfConnectedIntent: string): string {
    const { delimiterCharacter } = FileWriter;
    const { name } = this.getIntent(idOfConnectedIntent) as flow.Intent;
    return this.text.truncateBasename([...inputContexts, name].join(delimiterCharacter));
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
      await writeJson(join(pathToEntities, `${entityNameWithoutForbiddenCharaters}.json`), entityData, { EOL, spaces: 2 });
      this.emit("write-complete", { basename: `${entityNameWithoutForbiddenCharaters}.json` });
      await writeJson(join(pathToEntities, `${entityNameWithoutForbiddenCharaters}_entries_en.json`), entityEntries, { EOL, spaces: 2 });
      this.emit("write-complete", { basename: `${entityNameWithoutForbiddenCharaters}_entries_en.json` });
    }
  }
  /**
   * Writes intent files for artifically inserted intent between root message and first message
   * 
   * @remarks sets response messages and affected contexts based on the first message connected
   * to the root message
   * 
   * @param providerInstance PlatformProvider
   * @returns Promise<void>
   */
  private async writePseudoWelcomeIntent(providerInstance: PlatformProvider): Promise<void> {
    const pathToTemplates = join(this.templateDirectory, "defaults");
    const { welcomeIntentName } = FileWriter;
    const intentData = JSON.parse(await readFile(join(pathToTemplates, `${welcomeIntentName}.json`), "utf8"));
    intentData.responses[0].messages = [
      this.getMessage(this.firstMessage.message_id),
      ...this.getMessagesForMessage(this.firstMessage.message_id)
    ].map((message: flow.Message) => (
      providerInstance.create(message.message_type, message.payload)
    ));
    intentData.responses[0].affectedContexts = [
      ...this.getOutputContextsForMessageConnectedByIntent(this.firstMessage.message_id)
    ];
    const utteranceData = JSON.parse(await readFile(join(pathToTemplates, `${welcomeIntentName}_usersays_en.json`), "utf8"));
    await writeJson(join(this.pathToIntents, `${welcomeIntentName}.json`), intentData, { EOL, spaces: 2 });
    this.emit("write-complete", { basename: `${welcomeIntentName}_entries_en.json` });
    await writeJson(join(this.pathToIntents, `${welcomeIntentName}_usersays_en.json`), utteranceData, { EOL, spaces: 2 });
    this.emit("write-complete", { basename: `${welcomeIntentName}_entries_en.json` });
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
      for (const idOfConnectedIntent of idsOfConnectingIntents) {
        if (!this.getIntent(idOfConnectedIntent)) {
          await this.writePseudoWelcomeIntent(platformProvider);
          continue;
        }
        const inputContexts = this.getInputContextsForMessageConnectedByIntent(idOfConnectedMessage);
        const intentName = this.createFilenameForIntent(inputContexts, idOfConnectedIntent);
        const intentData = {
          id: idOfConnectedIntent,
          name: intentName,
          auto: true,
          contexts: inputContexts,
          responses: [
            {
              resetContexts: false,
              affectedContexts: [
                ...inputContexts.map(inputContext => ({
                  name: inputContext,
                  parameters: {},
                  lifespan: FileWriter.lifespan
                })),
                ...this.getOutputContextsForMessageConnectedByIntent(idOfConnectedMessage)
              ],
              parameters: this.getParametersForIntent(idOfConnectedIntent),
              messages: [
                this.getMessage(idOfConnectedMessage),
                ...this.getMessagesForMessage(idOfConnectedMessage),
              ].map((message: flow.Message) => (
                platformProvider.create(message.message_type, message.payload)
              )),
              defaultResponsePlatforms: FileWriter.supportedPlatforms.has(platform)
                ? { [platform]: true }
                : {},
              speech: [],
            }
          ],
          priority: this.getPriorityForIntent(idOfConnectedIntent),
          webhookUsed: false,
          webhookForSlotFilling: false,
          fallbackIntent: false,
          events: this.getEventsForIntent(idOfConnectedIntent),
          conditionalResponses: [],
          condition: "",
          conditionalFollowupEvents: [],
        };
        const utteranceData = (this.getIntent(idOfConnectedIntent) as flow.Intent)
          .utterances
          .map(utterance => {
            return {
              id: uuid4(),
              data: utterance.text.split(FileWriter.botmockVariableCharacter)
                .filter(text => text !== "")
                .map(text => {
                  let entityForVariableInTextSegment: any;
                  const variableInTextSegment = this.projectData.variables.find(variable => (
                    variable.name === text.trim()
                  ));
                  if (typeof variableInTextSegment !== "undefined") {
                    try {
                      entityForVariableInTextSegment = findPlatformEntity(
                        variableInTextSegment.entity,
                        { platform: "dialogflow" }
                      );
                    } catch (_) {
                      const entity = this.projectData.entities.find(customEntity => (
                        customEntity.id === variableInTextSegment.entity
                      ));
                      if (typeof entity !== "undefined") {
                        entityForVariableInTextSegment = `@${this.sanitizeEntityName(entity.name)}`;
                      } else {
                        entityForVariableInTextSegment = "@sys.any";
                      }
                    }
                  }
                  return {
                    text: typeof variableInTextSegment !== "undefined" ? text.replace(/\s/g, "") : text,
                    userDefined: false,
                    ...(typeof variableInTextSegment !== "undefined"
                      ? {
                        alias: text.replace(/\s/g, ""),
                        meta: entityForVariableInTextSegment,
                      }
                      : {})
                  };
                }),
              isTemplate: false,
              count: 0,
              updated: 0,
            };
          });
        await writeJson(join(this.pathToIntents, `${intentName}.json`), intentData, { EOL, spaces: 2 });
        this.emit("write-complete", { basename: `${intentName}.json` });
        await writeJson(join(this.pathToIntents, `${intentName}_usersays_en.json`), utteranceData, { EOL, spaces: 2 });
        this.emit("write-complete", { basename: `${intentName}._usersays_en.json` });
      }
    }
  }
  /**
   * Writes necessary files to output directory
   * @returns Promise<void>
   */
  public async write(): Promise<void> {
    await this.writeMeta();
    await this.writeEntities();
    await this.writeIntents();
  }
}
