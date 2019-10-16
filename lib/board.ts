import * as flow from "@botmock-api/flow";

interface Config {
  readonly board: any;
}

export default class {
  private readonly board: any;
  /**
   * Creates new instance of BoardBoss class
   * @param config object containing options
   */
  constructor(config: Config) {
    this.board = config.board;
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
    return false;
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
