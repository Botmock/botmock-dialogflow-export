import { tmpdir } from "os";
import { join } from "path";
import { mkdirp, remove, readdir, readFile } from "fs-extra";
import { default as FileWriter } from "../lib/file";
import { mockProjectData } from "./fixtures";

let instance: FileWriter;
const outputDirectory = join(tmpdir(), mockProjectData.project.platform);
beforeAll(async () => {
  await mkdirp(join(outputDirectory, "intents"));
  await mkdirp(join(outputDirectory, "entities"));
  instance = new FileWriter({ outputDirectory, projectData: mockProjectData });
});

afterAll(async () => {
  await remove(join(outputDirectory, "intents"));
  await remove(join(outputDirectory, "entities"));
});

describe("file meta data", () => {
  beforeEach(async () => {
    await instance.write();
  });
  test("writes files to output dir", async () => {
    const contents = await readdir(outputDirectory);
    expect(contents.includes("entities")).toBeTruthy();
    expect(contents.includes("intents")).toBeTruthy();
    expect(contents.includes("agent.json")).toBeTruthy();
    expect(contents.includes("package.json")).toBeTruthy();
  });
  test("writes correct number of files", async () => {
    const files = await readdir(join(outputDirectory, "intents"));
    expect(files).toHaveLength(2);
  });
});

describe("file content", () => {
  beforeEach(async () => {
    await instance.write();
  });
  test.todo("no title field has text length exceeding limit");
  test("welcome intent has correct messages", async () => {
    const file = JSON.parse(await readFile(join(outputDirectory, "intents", `${FileWriter.welcomeIntentName}.json`), "utf8"));
    expect(file.responses).toHaveLength(1);
    expect(file.responses[0]).toEqual({
      resetContexts: false,
      action: "input.welcome",
      affectedContexts: [],
      parameters: [],
      messages: [{
        lang: "en",
        payload: {},
        type: 4,
      }],
      defaultResponsePlatforms: {},
      speech: [],
    });
  });
  test("welcome utterances are correct", async () => {
    const file = JSON.parse(await readFile(join(outputDirectory, "intents", `${FileWriter.welcomeIntentName}_usersays_en.json`), "utf8"));
    expect(file).toHaveLength(17);
  });
  test.todo("intent files have correct input context");
  test.todo("intent files have correct output context");
  test.todo("intent files have correct parameters");
  test.todo("utterance files have correct field content");
});
