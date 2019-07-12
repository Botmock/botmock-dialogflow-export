export default class BoardExplorer {
  board: any;
  intentMap: any;

  constructor({ board, intentMap }: any) {
    this.board = board;
    this.intentMap = intentMap;
  }

  // gets the message with this id from the board
  public getMessageFromId(id: string) {
    return this.board.messages.find(m => m.message_id === id);
  }

  // determines if given message is the root
  public messageIsRoot(message: { message_id: string }): boolean {
    return this.board.root_messages.includes(message.message_id);
  }

  // determines if given id is the node adjacent to root with max number of connections
  public hasWelcomeIntent(id: string) {
    const messages = this.intentMap.size
      ? this.board.messages.filter(message =>
          this.intentMap.has(message.message_id)
        )
      : this.board.messages;
    const [{ message_id }] = messages.sort(
      (a, b) =>
        b.previous_message_ids.filter(this.messageIsRoot.bind(this)).length -
        a.previous_message_ids.filter(this.messageIsRoot.bind(this)).length
    );
    return id === message_id;
  }

  // determines if root node does not contain connections with intents
  public isMissingWelcomeIntent(messages: any[]): boolean {
    const [{ next_message_ids }] = messages.filter(
      this.messageIsRoot.bind(this)
    );
    return next_message_ids.every(message => !message.intent);
  }
}
