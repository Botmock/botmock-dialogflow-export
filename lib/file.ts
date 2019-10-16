// import { writeJson } from "fs-extra";
import * as flow from "@botmock-api/flow";
import { default as BoardBoss } from "./board";
// import { default as TextOperator } from "./text";
// import { default as PlatformProvider } from "./providers";

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
   * Writes files that contain meta data
   * @returns Promise<void>
   */
  private async writeMeta(): Promise<void> {}
  /**
   * Writes files that contain entities
   * @returns Promise<void>
   */
  private async writeEntities(): Promise<void> {}
  /**
   * Writes intent files and utterance files
   * @returns Promise<void>
   */
  private async writeIntents(): Promise<void> {}
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
