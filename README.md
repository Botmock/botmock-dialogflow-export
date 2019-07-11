# Botmock Dialogflow Export

Import [Botmock](https://botmock.com) projects in Dialogflow.

## prerequisites

- [Node.js](https://nodejs.org/en/) >= 10.16.x

```shell
node --version
```

- [Dialogflow](https://console.dialogflow.com) account

### guide

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

Note that you may also set `INTENT_NAME_DELIMITER` to control the way intent files are named.

Start the script:

```shell
npm start
```

- Run `npm install`
- Run `npm start`
- Find your zipped project in `/output.zip`

### importing to Dialogflow

- Visit [your dashboard](console.dialogflow.com) and create a new agent
- Choose the 'Export and Import' tab and choose 'Import From Zip'
- Select `/output.zip`, typing 'IMPORT' in their form field and clicking 'IMPORT'

## glossary

| **Botmock** | **Dialogflow**  |
| ----------- | --------------- |
| utterance   | training phrase |
| variable    | parameter       |

## want to help?

Found bugs or have some ideas to improve this plugin? We'd love to to hear from you! You can start by submitting an issue at the [Issues](https://github.com/Botmock/botmock-dialogflow-export/issues) tab. If you want, feel free to submit a pull request and propose a change as well!

### submitting a Pull Request

1. Adding a Pull Request
2. Start with creating an issue if possible, the more information, the better!
3. Fork the Repository
4. Make a new change under a branch based on master. Ideally, the branch should be based on the issue you made such as issue-530
5. Send the Pull Request, followed by a brief description of the changes you've made. Reference the issue.

_NOTE: Make sure to leave any sensitive information out of an issue when reporting a bug with imagery or copying and pasting error data. We want to make sure all your info is safe!_

## license

Botmock Dialogflow Export is copyright © 2019 Botmock. It is free software, and may be redistributed under the terms specified in the LICENSE file.
