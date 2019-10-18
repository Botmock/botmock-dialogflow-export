import { tmpdir } from "os";
import { join } from "path";
import { mkdirp, remove, readdir } from "fs-extra";
import { default as FileWriter } from "../lib/file";
import { mockProjectData } from "./fixtures";

let instance: FileWriter;
const outputDirectory = tmpdir();
beforeAll(async () => {
  await mkdirp(join(outputDirectory, "intents"));
  await mkdirp(join(outputDirectory, "entities"));
  instance = new FileWriter({ outputDirectory, projectData: mockProjectData });
});

afterAll(async () => {
  await remove(join(outputDirectory, "intents"));
  await remove(join(outputDirectory, "entities"));
});

test("writes files to output dir", async () => {
  await instance.write();
  const contents = await readdir(outputDirectory);
  expect(contents.includes("agent.json")).toBeTruthy();
});
