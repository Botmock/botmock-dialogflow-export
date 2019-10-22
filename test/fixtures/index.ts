import { uuid4 } from "@sentry/utils";

const messageId = uuid4();
const intentId = uuid4();

export const variableName = "v";

export const mockProjectData = {
  project: { platform: "" },
  board: {
    board: {
      messages: [
        {
          is_root: true,
          message_id: messageId,
          next_message_ids: [{ message_id: uuid4(), intent: { label: "", value: intentId }, action: "", conditional: "" }],
        },
        {
          message_id: uuid4(),
          previous_message_ids: [],
          next_message_ids: [],
        }
      ],
      root_messages: [messageId]
    }
  },
  entities: [],
  intents: [{
    id: intentId,
    name: "",
    utterances: [
      { text: "", variables: [{ name: `%${variableName}%` }] }, { text: "_", variables: [{ name: `%${variableName}%` }] }
    ],
    created_at: {},
    updated_at: {},
    is_global: false,
    slots: [],
  }],
  variables: [],
};
