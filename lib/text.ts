import * as flow from "@botmock-api/flow";
import { randomBytes } from "crypto";

interface Config { }

export default class TextTransformer {
  static readonly characterLimit = 100;
  static readonly dialogflowCharacter = "$";
  /**
   * Creates new instance of the TextTransformer class
   * @param config Config
   */
  constructor(config?: Config) { }
  /**
   * Replaces all occurances of variable char in given text
   * @param text string
   * @returns string
   */
  public replaceVariableCharacterInText(text: string): string {
    const { dialogflowCharacter } = TextTransformer;
    const variableRegex: RegExp = /%[a-zA-Z0-9]+%/g;
    const matches: RegExpMatchArray | null = text.match(variableRegex);
    let str: string = text;
    if (!Object.is(matches, null)) {
      for (const match of matches) {
        const rawText = match.slice(1, match.length - 1);
        const indexOfMatchBegin = text.indexOf(match);
        const indexOfMatchEnd = indexOfMatchBegin + match.length;
        str =
          str.slice(0, indexOfMatchBegin) +
          dialogflowCharacter +
          rawText +
          " " +
          str.slice(indexOfMatchEnd);
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
   * 
   * @remarks if the name length exceeds the limit, replaces the number of characters
   * by which the name exceeds the limit with random bytes to avoid file name collisions
   * for similar paths
   * 
   * @param name string
   * @returns string
   */
  public truncateBasename(basename: string = ""): string {
    const { characterLimit } = TextTransformer;
    const diff = characterLimit - basename.length;
    if (Object.is(Math.sign(diff), -1)) {
      const absDiff = Math.abs(diff);
      return basename
        .slice(absDiff + Math.floor(characterLimit / 2))
        .padStart(characterLimit, randomBytes(characterLimit).toString("hex"));
    }
    return basename;
  }
}
