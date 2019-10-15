import * as flow from "@botmock-api/flow";
import { randomBytes } from "crypto";

interface Options {}

export default class {
  // private readonly options: any;
  /**
   * Creates new instance of the TextOperator class
   * @param options Options object
   */
  constructor(options: Options) {}
  /**
   * Replaces all occurances of variable sign in given text
   * @param text string possibly containing variables
   * @returns string
   */
  public replaceVariableSignInText(text: string): string {
    let str = text;
    const variableRegex = /%[a-zA-Z0-9]+%/g;
    const matches = text.match(variableRegex);
    // if this text contains at least one variable, replace all
    // occurrences of it with the correct output variable sign
    if (!Object.is(matches, null)) {
      for (const match of matches) {
        const indexOfMatch = text.search(variableRegex);
        str =
          str.slice(0, indexOfMatch) +
          "$" +
          match.slice(1, match.length - 1) +
          str.slice(indexOfMatch + match.length);
      }
    }
    return str;
  }
  /**
   * Gets array containing unique names of variables in given utterances
   * @param utterances flow.Utterance[]
   * @returns any[]
   */
  public getUniqueVariablesInUtterances(utterances: flow.Utterance[]): any[] {
    return Object.keys(
      utterances
        .filter(utterance => !!utterance.variables.length)
        .reduce(
          (acc, utterance) => ({
            ...acc,
            ...utterance.variables.reduce(
              (acc, variable) => ({
                ...acc,
                [variable.name.replace(/%/g, "")]: variable,
              }),
              {}
            ),
          }),
          {}
        )
    );
  }
  /**
   * Truncates the name of a file to fit within dialogflow bounds
   * @param name string
   * @returns string
   */
  public truncateBasename(basename: string = ""): string {
    const CHARACTER_LIMIT = 100;
    const diff = CHARACTER_LIMIT - basename.length;
    // if the name length exceeds the limit, replace the number of characters
    // by which the name exceeds the limit with random bytes to avoid file
    // name collisions for similar paths
    if (Object.is(Math.sign(diff), -1)) {
      const absDiff = Math.abs(diff);
      return basename
        .slice(absDiff + Math.floor(CHARACTER_LIMIT / 2))
        .padStart(CHARACTER_LIMIT, randomBytes(CHARACTER_LIMIT).toString("hex"));
    }
    return basename;
  }
}
