// import { writeJson } from "fs-extra";
import { EventEmitter } from "events";

interface Config {}

export default class FileWriter extends EventEmitter {
  constructor(config: Config) {
    super();
  }
  /**
   * Writes necessary files to output directory
   * @returns Promise<void>
   */
  public async write(): Promise<void> {}
}
