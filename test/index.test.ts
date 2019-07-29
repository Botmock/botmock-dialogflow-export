// import os from "os";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { OUTPUT_PATH } from "../";

test("creates output directory", () => {
  expect(async () => {
    console.log(process.cwd());
    promisify(exec)("npm start");
    await fs.promises.access(OUTPUT_PATH, fs.constants.R_OK);
  }).not.toThrow();
});

test.todo("creates a welcome intent");
test.todo("creates correct context");
test.todo("formats generated JSON");
test.todo("produces correct number of intent files");
test.todo("produces correct number of utterance files");
test.todo("correctly calculates response limits");
test.todo("warns in the case of exceeding response limits");
