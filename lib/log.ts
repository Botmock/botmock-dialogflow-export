import chalk from "chalk";

interface LogConfig {
  readonly isQuiet: boolean;
}

/**
 * Prints string to stdout
 * @param str the string to print
 * @param config object dictating which chalk method to use to print
 */
export default function log(str: string | number, config: LogConfig = { isQuiet: false }): void {
  const method = !config.isQuiet ? "dim" : "gray";
  console.info(chalk[method](`> ${str}`));
}
