export type InputContext = string;

export type OutputContext = {
  name: string | void;
  parameters: {};
  lifespan: number;
};

export type Parameter = {
  id: string;
  required: boolean;
  dataType: string;
  name: string;
  value: string;
  promptMessages: any[];
  noMatchPromptMessages: [];
  noInputPromptMessages: [];
  outputDialogContexts: [];
  isList: boolean;
};
