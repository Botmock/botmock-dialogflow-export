import "dotenv/config";
import { readdir, mkdirp, remove } from "fs-extra";
import { join } from "path";
import { execSync } from "child_process";
import { EOL, tmpdir } from "os";
import { mockProjectData, variableName } from "./fixtures";
import { default as SDKWrapper } from "../lib/sdk";
import { default as FileWriter } from "../lib/file";
import { default as BoardBoss } from "../lib/board";
import { default as TextTransformer } from "../lib/text";
import { default as PlatformProvider } from "../lib/providers";

describe("run", () => {
  test("outputs correct number of newlines", () => {
    const res = execSync("npm start");
    expect(res.toString().split(EOL)).toHaveLength(10);
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

describe("interaction of file writer and util classes", () => {
  let fileWriterInstance: FileWriter;
  const outputDirectory = tmpdir();
  const projectData = mockProjectData;

  beforeEach(async () => {
    await mkdirp(join(outputDirectory, "intents"));
    fileWriterInstance = new FileWriter({ outputDirectory, projectData });
  });

  afterEach(async () => {
    await remove(join(outputDirectory, "intents"));
  });

  test("file writer output is correct on mock data", async () => {
    await new FileWriter({ outputDirectory, projectData }).write();
    const contents = await readdir(join(outputDirectory, "intents"));
    expect(contents).toEqual([
      "Default Welcome Intent.json",
      "Default Welcome Intent_usersays_en.json"
    ]);
  });
  
  describe("board boss", () => {
    test("board boss can consume file writer project data", () => {
      const board = fileWriterInstance.projectData.board.board;
      const boardStructureByMessages = fileWriterInstance.segmentizeBoardFromMessages();
      expect(() => {
        new BoardBoss({ projectData, board, boardStructureByMessages })
      }).not.toThrow();
    });
    test.todo("board boss can get messages in project data");
  });

  describe("text transformer", () => {
    test.todo("text transformer affects intent file parameters");
    describe("text transformer public methods", () => {
      let textTransformerInstance: TextTransformer;
      beforeEach(() => {
        textTransformerInstance = new TextTransformer();
      });
      test("truncate basename", () => {
        const longFilename = __dirname.repeat(12);
        expect(textTransformerInstance.truncateBasename(longFilename)).toHaveLength(100);
      });
      test("get unique variables in utterances", () => {
        const [{ utterances }] = mockProjectData.intents;
        // @ts-ignore
        expect(textTransformerInstance.getUniqueVariablesInUtterances(utterances)).toEqual([variableName]);
      });
      test("replace variable character in text", () => {
        const text = `%${variableName}%__`;
        expect(textTransformerInstance.replaceVariableCharacterInText(text)).toBe(`$${variableName}__`);
      });
    });
  });  

  describe("platform provider", () => {
    let platformProviderInstance: PlatformProvider;
    beforeEach(() => {
      platformProviderInstance = new PlatformProvider("generic");
    });
    describe("platform provider inputs", () => {
      test.todo("platform provider can consume collected messages");
    });
    describe("platform provider methods", () => {
      test.todo("text");
      test.todo("card");
      test.todo("image");
      test.todo("quick_replies");
    });
  });
});
