import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { OUTPUT_PATH } from "../";

test("creates output directory", done => {
  expect(async () => {
    await promisify(exec)("npm start");
    await fs.promises.access(OUTPUT_PATH, fs.constants.R_OK);
    done();
  }).not.toThrow();
});

test("creates correct number of top level files and directories", async done => {
  await promisify(exec)("npm start");
  const output = await fs.promises.readdir(OUTPUT_PATH);
  // omit dotfile
  expect(output.slice(1)).toHaveLength(4);
  done();
});

test.todo("formats generated JSON");
test.todo("includes welcome intent in output directory");
test.todo("produces correct number of intent files");
test.todo("produces correct number of utterance files");
test.todo("avoids naming collisions");
test.todo("throws in the case bad project data");
test.todo("warns in the case of exceeding response limits");
