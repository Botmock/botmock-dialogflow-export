import { uuid4 } from "@sentry/utils";

const id = uuid4();

export const mockProjectData = {
  project: { platform: "" },
  board: {
    board: { messages: [{ message_id: id, next_message_ids: [{ message_id: uuid4(), intent: "" }] }],
    root_messages: [id] }
  },
  entities: [],
  intents: [],
  variables: [],
};
