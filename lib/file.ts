// import { writeJson } from "fs-extra";
import * as flow from "@botmock-api/flow";

interface Config {
  readonly outputDirectory: string;
  readonly projectData: any;
}

export default class FileWriter extends flow.AbstractProject {
  // static defaultWelcomeIntent: any = {};
  private readonly outputDirectory: string;
  /**
   * Creates new instance of FileWriter class
   * @param config Config object containing outputDirectory and projectData
   */
  constructor(config: Config) {
    super({ projectData: config.projectData });
    this.outputDirectory = config.outputDirectory;
  }
  /**
   * Writes necessary files to output directory
   * @returns Promise<void>
   */
  public async write(): Promise<void> {}
}
