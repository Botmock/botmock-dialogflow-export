import * as flow from "@botmock-api/flow";
import { randomBytes } from "crypto";

interface Config {}

export default class TextTransformer {
  static readonly characterLimit = 100;
  static readonly dialogflowCharacter = "$";
  /**
   * Creates new instance of the TextTransformer class
   * @param config Config object
   */
  constructor(config: Config) {}
  /**
   * Replaces all occurances of variable char in given text
   * @param text string
   * @returns string
   */
  public replaceVariableCharacterInText(text: string): string {
    let str: string = text.replace(/\s/g, "");
    const { dialogflowCharacter } = TextTransformer;
    const variableRegex: RegExp = /%[a-zA-Z0-9]+%/g;
    const matches: RegExpMatchArray | null = text.match(variableRegex);
    // if this text contains at least one variable, replace all
    // occurrences of it with the correct output variable sign
    if (!Object.is(matches, null)) {
      for (const match of matches) {
        const indexOfMatch: number = text.search(variableRegex);
        str =
          str.slice(0, indexOfMatch) +
          dialogflowCharacter +
          match.slice(1, match.length - 1) +
          str.slice(indexOfMatch + match.length);
      }
    }
    return str;
  }
  /**
   * Gets array containing unique names of variables in given utterances
   * @param utterances flow.Utterance[]
   * @returns string[]
   */
  public getUniqueVariablesInUtterances(utterances: flow.Utterance[]): string[] {
    return Object.keys(
      utterances
        .filter((utterance: flow.Utterance) => !!utterance.variables.length)
        .reduce(
          (acc, utterance) => ({
            ...acc,
            ...utterance.variables.reduce(
              (acc, variable) => ({
                ...acc,
                [variable.name.replace(/%/g, "")]: void 0,
              }),
              {}
            ),
          }),
          {}
        )
    );
  }
  /**
   * Truncates a file basename to within dialogflow limit
   * @param name string
   * @returns string
   */
  public truncateBasename(basename: string = ""): string {
    const { characterLimit } = TextTransformer;
    const diff = characterLimit - basename.length;
    // if the name length exceeds the limit, replace the number of characters
    // by which the name exceeds the limit with random bytes to avoid file
    // name collisions for similar paths
    if (Object.is(Math.sign(diff), -1)) {
      const absDiff = Math.abs(diff);
      return basename
        .slice(absDiff + Math.floor(characterLimit / 2))
        .padStart(characterLimit, randomBytes(characterLimit).toString("hex"));
    }
    return basename;
  }
}
