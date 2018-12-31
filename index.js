const env = require('node-env-file');
env(__dirname + '/.env');
const fs = require('fs-extra');
const mkdirp = require('mkdirp');
const uuidv1 = require('uuid/v1');
const { renderString, renderTemplateFile } = require('template-file')
const Botmock = require('botmock');




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
    // console.log(node);
    node['next_message_ids'].forEach(message => {
        if (!messages_seen.has(message['message_id'])) {

          if (message['action'] && typeof message['action'] !== 'string') {
            
            if (!intent_dict[message['action']['title']]) {
              intent_dict[message['action']['title']] = []; 
            }
            intent_dict[message['action']['title']].push(message['message_id']);
          }
          queue.push(message['message_id']);
          messages_seen.add(message['message_id']);
        }
    });
    // foreach (message in node["next_message_ids"]) {
    //   console.log(message)
    
    // }
  }

}).then(() => { 
  console.log(intent_dict);
});
