import "dotenv/config";
// import { default as fetch } from "node-fetch";
import { readdir, mkdirp, remove } from "fs-extra";
import { join } from "path";
import { execSync } from "child_process";
import { EOL, tmpdir } from "os";
import { mockProjectData, variableName } from "./fixtures";
import { default as FileWriter } from "../lib/file";
import { default as BoardBoss } from "../lib/board";
import { default as TextTransformer } from "../lib/text";
import { default as PlatformProvider } from "../lib/providers";

interface Config {
  readonly projectId: string;
}

class DialogflowActor {
  private readonly restoreURL: string;
  /**
   * Creates new instance of DialogflowActor
   * @param config Config
   */
  constructor(config: Config) {
    const { projectId } = config;
    this.restoreURL = `https://dialogflow.googleapis.com/v2beta1/${projectId}/agent:restore`;
  }
  /**
   * Attempts to restore a Dialogflow agent from zip file produced by exporter
   * @param pathToZip string
   * @returns Promise<any>
   * @todo
   */
  public async restoreFromZip(pathToZip: string): Promise<any> {
    return;
  }
}

describe.skip("import", () => {
  let actorInstance: DialogflowActor;
  beforeAll(() => {
    actorInstance = new DialogflowActor({ projectId: process.env.DIALOGFLOW_PROJECT_ID });
  });
  test("entire project is able to be restored from without error", () => {
    expect(async () => {
      execSync("npm start");
      const pathToDefaultOutputDirectory = join(process.cwd(), "output.zip");
      await actorInstance.restoreFromZip(pathToDefaultOutputDirectory);
    }).not.toThrow();
  });
});

describe("run", () => {
  const pathToDefaultOutputDirectory = join(process.cwd(), "output");
  afterAll(async () => {
    await remove(pathToDefaultOutputDirectory);
  });
  test("outputs correct number of newlines", () => {
    const res = execSync("npm start");
    expect(res.toString().split(EOL).length).toBeGreaterThanOrEqual(13);
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
  });

  describe("text transformer", () => {
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
        expect(textTransformerInstance.replaceVariableCharacterInText(text).startsWith(`$${variableName}`)).toBeTruthy();
      });
    });
  });  

  describe("platform provider", () => {
    let platformProviderInstance: PlatformProvider;
    beforeEach(() => {
      platformProviderInstance = new PlatformProvider("generic");
    });
    describe("platform provider methods", () => {
      test("text", () => {
        const payload = { text: "_" };
        expect(platformProviderInstance.create("text", payload)).toEqual({
          condition: "",
          lang: "en",
          platform: undefined,
          speech: "_",
          type: 0,
        });
      });
      test("card", () => {
        const payload = { text: "t", elements: [{ buttons: [{ title: "_", payload: "__" }] }] };
        expect(platformProviderInstance.create("card", payload)).toEqual({
          buttons: [{
            postback: "__",
            text: "_"
          }],
          condition: "",
          lang: "en",
          platform: undefined,
          title: "t",
          type: 1,
        });
      });
      test("image", () => {
        const payload = { image_url: "_" };
        expect(platformProviderInstance.create("image", payload)).toEqual({
          condition: "",
          imageUrl: "_",
          lang: "en",
          platform: undefined,
          type: 3,
        });
      });
      test("quick_replies", () => {
        const payload = { text: "", quick_replies: [{ title: "_" }] };
        expect(platformProviderInstance.create("quick_replies", payload)).toEqual({
          condition: "",
          lang: "en",
          title: "",
          replies: ["_"],
          platform: undefined,
          type: 2,
        });
      });
    });
  });
});
