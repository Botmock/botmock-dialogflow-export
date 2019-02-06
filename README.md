# Botmock Dialogflow Export

> requires node >= 10.15.x

Script to make a [Botmock](https://botmock.com) project importable in Dialogflow.

## Guide

### Running the script

- Clone this repo by running `git clone git@github.com:Botmock/botmock-dialogflow-export.git`
- Create a `.env` file in `/botmock-dialogflow-export` with the following variables (and your values filled in)

```console
BOTMOCK_TOKEN=""
BOTMOCK_TEAM_ID=""
BOTMOCK_PROJECT_ID=""
BOTMOCK_BOARD_ID=""
```

- Run `npm install`
- Run `node index.js --host=app`
- Once it successfully runs, it will create a `output` directory with all the content files in it
- Zip the `output` directory

### Importing to Dialogflow

- Visit [your dashboard](console.dialogflow.com) and create a new agent
- Choose the 'Export and Import' tab and choose 'Import From Zip'
- Select `output.zip`, typing 'IMPORT' in their form field and clicking 'IMPORT'
