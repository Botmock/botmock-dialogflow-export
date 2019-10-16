import * as flow from "@botmock-api/flow";

interface Config {
  readonly board: any;
  readonly boardStructureByIntents: flow.SegmentizedStructure;
}

export default class {
  private readonly board: any;
  private readonly boardStructureByIntents: flow.SegmentizedStructure;
  /**
   * Creates new instance of BoardBoss class
   * @param config object containing full board and board structure as seen
   * from intents
   */
  constructor(config: Config) {
    this.board = config.board;
    this.boardStructureByIntents = config.boardStructureByIntents;
  }
  /**
   * Determines if a given message id is the root message
   * @param messageId
   * @returns boolean
   */
  public messageIsRoot(messageId: string): boolean {
    return this.board.root_messages.includes(messageId);
  }
  /**
   * Determines if the entire board contains a welcome intent
   * @returns boolean
   * @todo
   */
  public containsWelcomeIntent(): boolean {
    const [rootMessage] = this.board.root_messages;
    return this.boardStructureByIntents.get(rootMessage).length > 0;
  }
  /**
   * Finds messages connected to message id that are not separated by an intent in the flow
   * @param messageId string
   * @returns string | flow.Message[]
   * @todo
   */
  public findMessagesUpToNextIntent(messageId: string): string | flow.Message [] {
    return [];
  }
}
