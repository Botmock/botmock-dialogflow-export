import path from "path";
import fs from "fs";
import arg from "arg";

export const supportedPlatforms = new Set([
  "facebook",
  "slack",
  "skype",
  "google",
]);

// parse argument vector for flags
export function getArgs(argv) {
  const args = arg(
    {
      "--debug": Boolean,
      "-d": "--debug",
      "--host": String,
      "-h": "--host",
    },
    { argv }
  );
  return {
    isInDebug: args["--debug"] || false,
    hostname: args["--host"] || "app",
  };
}

const intentTemplateData = fs.readFileSync(
  path.join(process.cwd(), "templates", "intent.json"),
  "utf8"
);

const entityTemplateData = fs.readFileSync(
  path.join(process.cwd(), "templates", "entity.json"),
  "utf8"
);

export const templates = {
  intent: JSON.parse(intentTemplateData),
  entity: JSON.parse(entityTemplateData),
};
