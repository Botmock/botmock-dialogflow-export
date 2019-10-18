import * as flow from "@botmock-api/flow";

interface Config {
  readonly projectData: any;
  readonly board: any;
  readonly boardStructureByMessages: flow.SegmentizedStructure;
}

export default class extends flow.AbstractProject {
  private readonly board: any;
  private readonly boardStructureByMessages: flow.SegmentizedStructure;
  /**
   * Creates new instance of BoardBoss class
   * @param config object containing full board and board structure as seen
   * from intents
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.board = config.board;
    this.boardStructureByMessages = config.boardStructureByMessages;
  }
  /**
   * Determines if the entire board contains a welcome intent
   * @returns boolean
   */
  public containsWelcomeIntent(): boolean {
    const [rootMessage] = this.board.root_messages;
    return !!this.boardStructureByMessages.get(rootMessage.message_id);
  }
  /**
   * Finds all messages connected to message that are not separated by an intent in the flow
   * @param message flow.Message
   * @returns flow.Message[]
   */
  public findMessagesUpToNextIntent(message: flow.Message): flow.Message[] {
    const messages: flow.Message[] = [];
    const self = this;
    (function gatherNextMessages(nextMessages: flow.NextMessage[]): void {
      for (const { message_id, intent } of nextMessages) {
        if (typeof intent === "string") {
          const message = self.getMessage(message_id) as flow.Message;
          messages.push(message);
          gatherNextMessages(message.next_message_ids);
        }
      }
    })(message.next_message_ids);
    return messages;
  }
}