import chalk from "chalk";

interface LogConfig {
  hasError: boolean;
}

/**
 * Prints string to stdout
 * @param str the string to print
 * @param config object dictating which chalk method to use to print
 */
export default function log(str: string | number, config: LogConfig = { hasError: false }): void {
  const method = !config.hasError ? "dim" : "bold";
  console.info(chalk[method](`> ${str}`));
}
