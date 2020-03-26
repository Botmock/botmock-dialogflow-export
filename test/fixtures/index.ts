import { v4 } from "uuid";

const nextMessageId = v4();
const messageId = v4();
const intentId = v4();

export const variableName = "v";

export const mockProjectData = {
  project: { platform: "generic" },
  board: {
    board: {
      messages: [
        {
          is_root: true,
          message_id: messageId,
          next_message_ids: [{ message_id: nextMessageId, intent: { label: "", value: intentId }, action: "", conditional: "" }],
        },
        {
          is_root: false,
          message_id: nextMessageId,
          previous_message_ids: [{ message_id: messageId }],
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
