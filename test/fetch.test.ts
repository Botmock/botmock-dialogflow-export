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
  const resourceNames = ["project", "board", "intents", "entities", "variables"];
  const { data } = await instance.fetch();
  expect.assertions(resourceNames.length);
  for (const name of resourceNames) {
    expect(data).toHaveProperty(name);
  }
});
