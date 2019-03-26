# Botmock Dialogflow Export

> requires node version >= 11

Import [Botmock](https://botmock.com) projects in Dialogflow.

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
- Run `npm start`
- Find your zipped project in `/output.zip`

### Importing to Dialogflow

- Visit [your dashboard](console.dialogflow.com) and create a new agent
- Choose the 'Export and Import' tab and choose 'Import From Zip'
- Select `/output.zip`, typing 'IMPORT' in their form field and clicking 'IMPORT'

## Glossary

| **Botmock**    | **Dialogflow**  |
| -------------- | --------------- |
| message / node | intent          |
| utterance      | training phrase |
| variable       | parameter       |
