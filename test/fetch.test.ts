import "dotenv/config";
import { default as SDKWrapper } from "../lib/sdk";

let instance: SDKWrapper;
beforeEach(() => {
  const [token, teamId, projectId, boardId] = [
    process.env.BOTMOCK_TOKEN,
    process.env.BOTMOCK_TEAM_ID,
    process.env.BOTMOCK_PROJECT_ID,
    process.env.BOTMOCK_BOARD_ID
  ];
  instance = new SDKWrapper({ token, teamId, projectId, boardId });
});

test("fetches required resources", async () => {
  const { data } = await instance.fetch();
  expect(data).toHaveProperty("project");
  expect(data).toHaveProperty("board");
  expect(data).toHaveProperty("intents");
  expect(data).toHaveProperty("entities");
  expect(data).toHaveProperty("variables");
});
