// @ts-ignore
import pkg from "./package.json";
import chalk from "chalk";
import execa from "execa";
import * as Sentry from "@sentry/node";
import * as inquirer from "inquirer";
import { existsSync } from "fs";
import { SENTRY_DSN } from "./lib/constants";
import * as commands from "./lib/commands";
// import { getUser } from "./util";
// import { Config } from "./types";

Sentry.init({
  dsn: SENTRY_DSN,
  release: `botmock-cli@${pkg.version}`,
});

type QuestionObject = {
  shouldUseContext: boolean;
};

async function main(args: string[]): Promise<void> {
  switch (args[2]) {
    // case commands.WHO_AM_I:
    // case commands.LOGIN:
    // case commands.LOGOUT:
    case commands.RUN:
      const prompts = [
        {
          type: "list",
          name: "shouldUseContext",
          message: "should input and output contexts be auto-generated?",
          choices: [{ name: "yes" }, { name: "no" }],
        },
      ];
      const userResponses = await inquirer.prompt<QuestionObject>(prompts);
      try {
        const { stdout } = await execa("ts-node", ["commands/run.ts"]);
        console.log(stdout);
      } catch (err) {
        throw err;
      }
      return;
    case commands.HELP:
      return;
    default:
      return;
  }
}

// function mapResponsesToBool(responses: string[]): boolean[] {}

// function log(str: string): void {
//   console.info(chalk.dim(`> ${str}`));
// }

process.on("unhandledRejection", () => {});
process.on("uncaughtException", () => {});

main(process.argv).catch(err => {
  Sentry.captureException(err);
});
