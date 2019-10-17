// import { default as SDKWrapper } from "../lib/sdk";
// import { default as FileWriter } from "../lib/file";
// import { default as BoardBoss } from "../lib/board";
// import { default as TextTransformer } from "../lib/text";
// import { default as PlatformProvider } from "../lib/providers";
import { execSync } from "child_process";
import { EOL } from "os";

describe("run", () => {
  test("outputs correct number of newlines", () => {
    const res = execSync("npm start");
    expect(res.toString().split(EOL)).toHaveLength(9);
  });
});
