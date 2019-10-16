import { join } from "path";
import { EOL } from "os";
import * as flow from "@botmock-api/flow";
import { writeJson, readFile } from "fs-extra";
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
  private readonly templateDirectory: string;
  private readonly outputDirectory: string;
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
    this.board = new BoardBoss({
      board: this.projectData.board.board,
      boardStructureByIntents
    });
  }
  /**
   * Writes files that contain agent meta data
   * @returns Promise<void>
   */
  private async writeMeta(): Promise<void> {
    const packageData = { version: "1.0.0" };
    const agentData = JSON.parse(await readFile(join(this.templateDirectory, "agent.json"), "utf8"));
    await writeJson(join(this.outputDirectory, "package.json"), packageData, { EOL, spaces: 2 });
    await writeJson(join(this.outputDirectory, "agent.json"), agentData, { EOL, spaces: 2 });
  }
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
