import "dotenv/config";
import { default as SDKWrapper } from "../lib/sdk";
import { default as FileWriter } from "../lib/file";
import { default as BoardBoss } from "../lib/board";
// import { default as TextTransformer } from "../lib/text";
// import { default as PlatformProvider } from "../lib/providers";
import { execSync } from "child_process";
import { EOL, tmpdir } from "os";
import { mockProjectData } from "./fixtures";

describe("run", () => {
  test("outputs correct number of newlines", () => {
    const res = execSync("npm start");
    expect(res.toString().split(EOL)).toHaveLength(9);
  });
});

describe("interaction of sdk wrapper and file writer", () => {
  let sdkWrapperInstance: SDKWrapper;
  const outputDirectory = tmpdir();
  beforeEach(() => {
    const [token, teamId, projectId, boardId] = [
      process.env.BOTMOCK_TOKEN,
      process.env.BOTMOCK_TEAM_ID,
      process.env.BOTMOCK_PROJECT_ID,
      process.env.BOTMOCK_BOARD_ID
    ];
    sdkWrapperInstance = new SDKWrapper({ token, teamId, projectId, boardId });
  });
  test("return value of sdk wrapper is consumable by file writer", async () => {
    const { data } = await sdkWrapperInstance.fetch();
    expect(() => {
      new FileWriter({ outputDirectory, projectData: data });
    }).not.toThrow();
  });
});

describe("interaction of board boss and file writer", () => {
  let fileWriterInstance: FileWriter;
  const outputDirectory = tmpdir();
  const projectData = mockProjectData;
  beforeEach(() => {
    fileWriterInstance = new FileWriter({ outputDirectory, projectData });
  });
  test("board boss can consume file writer project data", () => {
    const board = fileWriterInstance.projectData.board.board;
    const boardStructureByMessages = fileWriterInstance.segmentizeBoardFromMessages();
    expect(() => {
      new BoardBoss({ projectData, board, boardStructureByMessages })
    }).not.toThrow();
  });
});
