import "dotenv/config";
import { DialogflowExporter, FileWriter, Kind, ProjectReference } from "@botmock/export";

/**
 * Generates directory hierarchy in `./output`.
 *
 * @example
 * ```shell
 * npm start
 * ```
 */
async function main(): Promise<void> {
  const projectReference: ProjectReference = {
    teamId: process.env.TEAM_ID as string,
    projectId: process.env.PROJECT_ID as string,
    boardId: process.env.BOARD_ID,
  };
  const exporter = new DialogflowExporter({ token: process.env.TOKEN as string });
  const { data } = await exporter.exportProjectUnderDataTransformations({ projectReference });

  const writeResult = await (new FileWriter({ directoryRoot: "./output" })).writeAllResourcesToFiles({ data });
  if (writeResult.kind !== Kind.OK) {
    console.error(writeResult.value);
  }
}

process.on("unhandledRejection", () => { });
process.on("uncaughtException", () => { });

main().catch((err: Error) => {
  console.error(err);
});
