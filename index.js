const env = require('node-env-file');
env(__dirname + '/.env');
const fs = require('fs-extra');
const mkdirp = require('mkdirp');
const uuidv1 = require('uuid/v1');
const { renderString, renderTemplateFile } = require('template-file')
const Botmock = require('botmock');
const sanitize = require("sanitize-filename");


var Provider = require('./providers/provider.js');

// Botmock setup
const API_TOKEN = process.env.BOTMOCK_TOKEN;
const botmockClient = new Botmock({ "api_token": API_TOKEN, "debug": false });

let messages_seen = new Set();
let intent_dict = {};

// Let's call the API to get the document
botmockClient.boards(process.env.BOTMOCK_TEAM_ID, process.env.BOTMOCK_PROJECT_ID, process.env.BOTMOCK_BOARD_ID).then(data => {

  let queue = data.board.root_messages;
  let messages = data.board.messages;

  let messages_dict = data.board.messages.reduce(function(map, obj) {
    map[obj.message_id] = obj;
    return map;
  }, {});

  while (queue.length > 0 || messages_seen.length != messages.length) {
    node_id = queue.shift();

    if (!node_id || messages_seen.length === messages.length) {
      break;
    }

    node = messages_dict[node_id];
    node['next_message_ids'].forEach(message => {
        if (!messages_seen.has(message['message_id'])) {
          let nodeName = messages_dict[message['message_id']].payload.nodeName;
          if (!nodeName) {
            nodeName = '';
          }

          if (message['action'] && typeof message['action'] !== 'string') {
            let intentName = (nodeName === '' ? '' : nodeName + '_') + message['action']['title'];

            if (!intent_dict[intentName]) {
              intent_dict[intentName] = [];
            }
            intent_dict[intentName].push(message['message_id']);
          }
          queue.push(message['message_id']);
          messages_seen.add(message['message_id']);
        }
    });
  }

  // for each key in intent_dict, we will create an intent file.
  // the messages inside the intent file will be constructed depending
  // on the type of message.
  const provider = new Provider('default');

  mkdirp('output/intents/', (err) => {
    fs.copySync('templates/agent_template.json', 'output/agent.json');
    fs.copySync('templates/package_template.json', 'output/package.json');
    for (var intent of Object.keys(intent_dict)) {
      var message_ids = intent_dict[intent];
      var write_messages = [];
      for (var msg_id of message_ids) {
        var msg = messages_dict[msg_id];

        var msg_type = "custom";
        if (msg.message_type == "text") {
          msg_type = "text";
        }

        let data = provider.create(msg_type, msg.payload);
        write_messages.push(data);
      }

      // grab the generic intent template, and fill in id, name, and the messages
      let template = fs.readFileSync("templates/intent_template.json");
      let template_json = JSON.parse(template);

      template_json["id"] = uuidv1();
      template_json["name"] = intent;
      template_json["responses"][0]["messages"] = write_messages;

      // create folder for intents.
      // write out each file for intent.
      let data_out = JSON.stringify(template_json);
      fs.writeFileSync('output/intents/' + sanitize(intent) + '.json', data_out);

    }
    console.log("Export completed...");
  });

});
