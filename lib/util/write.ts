import uuid from "uuid/v4";
import os from "os";
import fs from "fs";

// const createOutputContextFromMessage = (
//   message: Message
// ): OutputContext => ({
//   name: getNameOfIntent(message.intent.value),
//   parameters: {},
//   lifespan: 1,
// });

// export async function writeIntentFile(intent: Intent): Promise<void> {}

export async function writeUtterancesFile(
  intentFilepath: string,
  utterances: any[],
  updatedAt: { date: string },
  entities: any[]
): Promise<void> {
  if (!Array.isArray(utterances) || !utterances.length) {
    return new Promise(res => res(undefined));
  }
  await fs.promises.writeFile(
    `${intentFilepath.slice(0, -5)}_usersays_en.json`,
    JSON.stringify(
      utterances.map(utterance => {
        const data = [];
        // reduce variables into lookup table of (start, end)
        // indices for that variable id
        const pairs: any[] = utterance.variables.reduce(
          (acc, variable) => ({
            ...acc,
            [variable.id]: [
              variable.start_index,
              variable.start_index + variable.name.length,
            ],
          }),
          {}
        );
        let lastIndex = 0;
        // save slices of text based on pair data
        for (const [id, [start, end]] of Object.entries(pairs)) {
          const previousBlock = [];
          if (start !== lastIndex) {
            previousBlock.push({
              text: utterance.text.slice(lastIndex, start),
              userDefined: false,
            });
          }
          const { name, entity: entityId } = utterance.variables.find(
            variable => variable.id === id
          );
          const entity = entities.find(entity => entity.id === entityId);
          if (typeof entity !== "undefined") {
            data.push(
              ...previousBlock.concat({
                text: name.slice(1, -1),
                meta: `@${entity.name}`,
                userDefined: true,
              })
            );
          }
          if (id !== Object.keys(pairs).pop()) {
            lastIndex = end;
          } else {
            data.push({
              text: utterance.text.slice(end),
              userDefined: false,
            });
          }
        }
        return {
          id: uuid(),
          data: data.length
            ? data
            : [{ text: utterance.text, userDefined: false }],
          count: 0,
          isTemplate: false,
          updated: Date.parse(updatedAt.date),
        };
      }),
      null,
      2
    ) + os.EOL
  );
}
