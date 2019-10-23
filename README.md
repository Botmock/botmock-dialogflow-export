# Botmock Dialogflow Export

[![Build Status](https://dev.azure.com/botmock/botmock-dialogflow-export/_apis/build/status/Botmock.botmock-dialogflow-export?branchName=master)](https://dev.azure.com/botmock/botmock-dialogflow-export/_build/latest?definitionId=2&branchName=master)

> import [botmock](https://botmock.com) projects in [dialogflow](https://console.dialogflow.com/)

This script produces a compressible directory able to be [restored](https://cloud.google.com/dialogflow/docs/agents-settings) from in the Dialogflow console.

## Table of Contents

* [Overview](#overview)
  * [Botmock project structure](#botmock-project-structure)
  * [Approach to importing](#approach-to-importing)
  * [Prerequisites](#prerequisites)
    * [nodejs](#nodejs)
    * [dialogflow](#dialogflow)
  * [Installation](#installation)
    * [clone](#clone)
    * [env](#env)
  * [Commands](#commands)
    * [start](#start)
    <!-- * [report](#report) -->
  * [Importing](#importing)
    * [restoration](#restoration)


## Overview

### Botmock project structure

To translate Botmock projects into Dialogflow agents, we make certain assumptions about Botmock project structure:

- Intents should be used on connectors in the flow as often as is meaningful. Doing so helps the script break
  up responses across different intent files so as to bypass the repsonse type limits Dialogflow
  has in place.

- If there is no intent on the connector from the root message to the first message in the Botmock flow, the 
  script creates one and merges into it all utterances from the default Dialogflow Welcome Intent.

### Approach to importing

The script maps input [context](https://cloud.google.com/dialogflow/docs/contexts-input-output) to the path of 
intents on connectors in the Botmock flow to control conversation paths. In other words, in the flow, a 
message downstream of a particular intent will require that intent as input context in the created file. 
Similarly, output contexts are set by the intents on connectors that go out of particular messages.

> Note that Dialogflow has a limit of **5** input contexts per intent. Projects should be structured to take account of this fact.

> Note also that Dialogflow has a limit of **100** characters in the name of any intent file. The script will begin to use random bytes in file names to prevent this limit from being exceeded.

### Prerequisites

#### NodeJS

- [NodeJS](https://nodejs.org/en/) Version 12.x

```shell
# check node version
node --version
```

#### Dialogflow

- [Dialogflow](https://console.dialogflow.com) account

### Installation

#### Clone

Clone this repository and install dependencies:

```shell
git clone git@github.com:Botmock/botmock-dialogflow-export.git

cd botmock-dialogflow-export

npm i
```

#### Env

Create `.env` in `/botmock-dialogflow-export` and fill in values for the following:

```shell
BOTMOCK_TOKEN=@botmock-token
BOTMOCK_TEAM_ID=@botmock-team-id
BOTMOCK_BOARD_ID=@botmock-board-id
BOTMOCK_PROJECT_ID=@botmock-project-id
```

To get your Botmock API token, follow the [guide](http://help.botmock.com/en/articles/2334581-developer-api).

### Commands

#### `start`

Populates `/output` with `.json` files produced from your original project.

```shell
npm start
```

### Importing

Once `npm start` is successfully run, `/output` should be able to be compressed and imported into Dialogflow.

- Visit [your dashboard](console.dialogflow.com) and create a new agent
- Choose the "Export and Import" tab and choose "RESTORE FROM ZIP"
- Select `output.zip`
- Type "RESTORE" into the form field, and click "RESTORE"
