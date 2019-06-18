# Botmock Dialogflow Export

> requires node >= 10.15.x

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

### Importing to Dialogflow

- Compress the `output` directory
- Visit [your dashboard](console.dialogflow.com) and create a new agent by clicking "Create new agent" in the top left dropdown.
- Click the gear icon at the top of the left sidebar.
- Choose the 'Export and Import' tab and choose 'Import From Zip'
- Choose your compressed `output` (e.g. `output.zip`), typing 'IMPORT' into the form field and clicking 'IMPORT'

## Glossary

| **Botmock**    | **Dialogflow**  |
| -------------- | --------------- |
| message / node | intent          |
| utterance      | training phrase |
| variable       | parameter       |

## Want to help?

Found bugs or have some ideas to improve this plugin? We'd love to to hear from you! You can start by submitting an issue at the [Issues](https://github.com/Botmock/botmock-dialogflow-export/issues) tab. If you want, feel free to submit a pull request and propose a change as well!

### Submitting a Pull Request

1. Adding a Pull Request
2. Start with creating an issue if possible, the more information, the better!
3. Fork the Repository
4. Make a new change under a branch based on master. Ideally, the branch should be based on the issue you made such as issue-530
5. Send the Pull Request, followed by a brief description of the changes you've made. Reference the issue.

_NOTE: Make sure to leave any sensitive information out of an issue when reporting a bug with imagery or copying and pasting error data. We want to make sure all your info is safe!_

## License

Botmock Dialogflow Export is copyright © 2019 Botmock. It is free software, and may be redistributed under the terms specified in the LICENSE file.
