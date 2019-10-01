# Botmock Dialogflow Export

![demo](https://i.imgur.com/y9yxoqu.gif)

[![CircleCI](https://circleci.com/gh/Botmock/botmock-dialogflow-export.svg?style=svg)](https://circleci.com/gh/Botmock/botmock-dialogflow-export)

[![Build status](https://ci.appveyor.com/api/projects/status/40b85tj9tbyqb6c0?svg=true)](https://ci.appveyor.com/project/nonnontrivial/botmock-dialogflow-export)

Import [Botmock](https://botmock.com) projects in [Dialogflow](https://console.dialogflow.com/).

This script produces a compressible directory able to be [restored](https://cloud.google.com/dialogflow/docs/agents-settings) from in Dialogflow.

## Introduction

### How to structure your Botmock Project

You have a Botmock project that you would like to translate into a Dialogflow project.
To accomplish this, we make certain assumptions about Botmock project structure:

- Intents should be used on connectors whereever meaningful. Doing so helps the script break
  up responses across different intent files so as to bypass the repsonse type limits Dialogflow
  has in place.

- If there is no intent from the root message in the Botmock flow, the script creates one and
  merges into it all utterances from the default Dialogflow welcome intent.

### DialogFlow Intents & Context

Currently, the script maps input [context](https://cloud.google.com/dialogflow/docs/contexts-input-output) to the path of intents on connectors
in the Botmock flow to control conversation paths. In other words, in the flow, a message downstream of a particular intent will require that
intent as input context in the created file. Similarly, output contexts are set by the intents on connectors that go out of particular messages.

> Note that Dialogflow has a limit of **5** input contexts per intent. Projects should be structured to take account of this fact.

Files are named by the formula: `${PROJECT_NAME}-${...INPUT_CONTEXT}-${MESSAGE_NAME}`.
The hyphens can be replaced by setting the `INTENT_NAME_DELIMITER` environment variable to the desired character.

> Note that Dialogflow has a limit of **100** characters in the name of any intent file. The script will begin to use random bytes in file names to prevent this limit from being exceeded.

### DialogFlow actions and parameters

**Mapping Actions and Parameters have known issues which will be address in subsequent pull requests**

### Feature To-Do List

- [ ] Filling Support 
- [ ] Multi-Lingual Support 
- [ ] DialogFlow Small Talk Support

## prerequisites

- [Node.js](https://nodejs.org/en/) Version 12.x

```shell
node --version
```

- [Dialogflow](https://console.dialogflow.com) account

## installation guide

Clone this repository and install dependencies:

```shell
git clone git@github.com:Botmock/botmock-dialogflow-export.git

cd botmock-dialogflow-export

npm i
```

Create `.env` in the newly-made directory and fill in values for the following:

```shell
BOTMOCK_TOKEN=@YOUR-BOTMOCK-TOKEN
BOTMOCK_TEAM_ID=@YOUR-BOTMOCK-TEAM-ID
BOTMOCK_BOARD_ID=@YOUR-BOTMOCK-BOARD-ID
BOTMOCK_PROJECT_ID=@YOUR-BOTMOCK-PROJECT-ID
```

To get your Botmock API Token follow the instructions on http://help.botmock.com/en/articles/2334581-developer-api

Start the script:

```shell
npm start
```

- Run `npm install`.
- Run `npm start`.
- Compress your output directory (`/output` by default).

### importing into DialogFlow

- Visit [your dashboard](console.dialogflow.com) and create a new agent
- Choose the 'Export and Import' tab and choose 'Import From Zip'
- Select your compressed output, typing 'IMPORT' in their form field and clicking 'IMPORT'

## glossary

| **Botmock** | **Dialogflow**  |
| ----------- | --------------- |
| utterance   | training phrase |
| message     | response        |

## want to help?

Found bugs or have some ideas to improve this plugin? We'd love to to hear from you! You can start by submitting an issue at the [Issues](https://github.com/Botmock/botmock-dialogflow-export/issues) tab. If you want, feel free to submit a pull request and propose a change as well!

_NOTE: Make sure to leave any sensitive information out of an issue when reporting a bug with imagery or copying and pasting error data. We want to make sure all your info is safe!_

## license

Botmock Dialogflow Export is copyright © 2019 Botmock. It is free software, and may be redistributed under the terms specified in the LICENSE file.
