# Botmock Dialogflow Export

Node.js project for importing [Botmock](https://botmock.com) projects in [Dialogflow](https://console.dialogflow.com/)

> **Note**: The deprecated version of this exporter can be found in the `legacy` branch.

## Table of Contents

* [Overview](#overview)
  * [Usage](#usage)
  * [Botmock project structure](#botmock-project-structure)
  * [Approach to importing](#approach-to-importing)
  * [Handling import errors](#handling-import-errors)

## Overview

### Usage

> **Note**: prerequisites
> - [Node.js LTS version](https://nodejs.org/en/)

Running the following commands should allow you to generate restorable content from your Botmock project.

- `git clone git@github.com:Botmock/botmock-dialogflow-export.git`
- `cd botmock-dialogflow-export`
- `npm install`
- `mv ./sample.env ./.env` and edit `.env` to contain your token and project ids
- `npm start`

The export is going to create an output folder. This folder consists of two folders:

- upload
- webhook

#### Upload Folder
This folder contains all the intent json files that Dialogflow agent needs. You will compress this "upload" folder to a .zip file which will be uploaded in Dialogflow.

#### Webhook Folder
This folder will contains three files

- blocks.json
   - blocks.json file contains all message blocks of your botmock project and thier payload. 
- conditions.json
  - conditions.json file contain intents names and inside intent you there are message block ids connected with conditions.  
- functions.js
  - functions.json is contain functions to get response of intent based on user's input. This file uses condition.json, blocks.json and [@botmock/utils](https://www.npmjs.com/package/@botmock/utils) to evaluate and return response.

These files will be handy if you are planning on using Dialogflow's fulfillment api.


### Botmock's Dialogflow exporter supports CONDITIONAL RESPONSES via webhooks

Please follow the [botmock-dialogflow-webhook-example](https://github.com/Botmock/botmock-dialogflow-webhook-example/blob/main/index.js) to learn how you can get started quickly with a nodeJS server already setup with our SDK

 

### Botmock Project Structure

To translate Botmock projects into Dialogflow agents, we make certain assumptions about Botmock project structure:

- Intents should be used on connectors in the flow as often as is meaningful. Doing so helps the script break
  up responses across different intent files so as to bypass the repsonse type limits Dialogflow
  has in place.

- If there is no intent on the connector from the root message to the first message in the Botmock flow, the
  script creates one and merges into it all utterances from the default Dialogflow Welcome Intent.

- When using quick replies or suggestion chips in a project, some intent utterances should be designed to exactly match the content of the options in the content block.

### Approach to importing

The script maps input [context](https://cloud.google.com/dialogflow/docs/contexts-input-output) to the path of
intents on connectors in the Botmock flow to control conversation paths. In other words, in the flow, a
message downstream of a particular intent will require that intent as input context in the created file.
Similarly, output contexts are set by the intents on connectors that go out of particular messages.

> Note that Dialogflow has a limit of **5** input contexts per intent. Projects should be structured to take account of this fact.

> Note also that Dialogflow has a limit of **100** characters in the name of any intent file. The script will begin to use random bytes in file names to prevent this limit from being exceeded.

### Handling import errors

If Dialogflow issues an error on import, note that you may have to manually edit `.json` files contained in output.
