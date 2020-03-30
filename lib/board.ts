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
   * @param config object containing full board and board structure as seen from intents
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.board = config.board;
    this.boardStructureByMessages = config.boardStructureByMessages;
  }
  /**
   * Determines if the entire board contains a welcome intent
   */
  public containsWelcomeIntent(): boolean {
    const [rootMessage] = this.board.root_messages;
    return !!this.boardStructureByMessages.get(rootMessage.message_id);
  }
}
