import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { OUTPUT_PATH } from "../";
// import * as fixtures from "../fixtures";

test("creates output directory", done => {
  expect(async () => {
    promisify(exec)("npm start");
    await fs.promises.access(OUTPUT_PATH, fs.constants.R_OK);
    done();
  }).not.toThrow();
});

test("creates correct number of top level files and directories", async done => {
  promisify(exec)("npm start");
  const output = await fs.promises.readdir(OUTPUT_PATH);
  expect(
    output
      .toString()
      .split(",")
      .filter(str => !str.match(/\.DS+/))
  ).toHaveLength(4);
  done();
});

test.todo("creates correct context");
test.todo("formats generated JSON");
test.todo("produces correct number of intent files");
test.todo("produces correct number of utterance files");
test.todo("correctly calculates response limits");
test.todo("warns in the case of exceeding response limits");
