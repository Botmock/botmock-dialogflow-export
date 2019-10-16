import { join } from "path";
import { mkdirp, readdir, remove } from "fs-extra";
import { default as FileWriter } from "../lib/file";

let instance: FileWriter;
const outputDirectory = join(__dirname, "test_output");
beforeEach(async () => {
  await mkdirp(outputDirectory);
  instance = new FileWriter({
    outputDirectory,
    projectData: { board: { board: { messages: [] } } }
  });
});

afterEach(async () => {
  await remove(outputDirectory);
});

test("writes files to output dir", async () => {
  await instance.write();
  const contents = await readdir(outputDirectory);
  expect(contents).toEqual(["agent.json", "package.json"]);
});
