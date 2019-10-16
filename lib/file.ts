// import { writeJson } from "fs-extra";
import * as flow from "@botmock-api/flow";
import { default as BoardBoss } from "./board";
// import { default as TextOperator } from "./text";

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
  private readonly outputDirectory: string;
  private readonly board: BoardBoss;
  /**
   * Creates new instance of FileWriter class
   * @param config Config object containing outputDirectory and projectData
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.outputDirectory = config.outputDirectory;
    this.board = new BoardBoss({ board: this.projectData.board.board });
  }
  /**
   * Writes necessary files to output directory
   * @returns Promise<void>
   */
  public async write(): Promise<void> {}
}
