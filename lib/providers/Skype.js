import { TEXT_TYPE, CARD_TYPE, QUICK_REPLIES_TYPE, IMAGE_TYPE } from "./";

module.exports = class Skype {
  text(data) {
    return { type: TEXT_TYPE, speech: data.text };
  }

  quick_replies(data) {
    const replies = data.quick_replies.map(reply => reply.title.substr(0, 19));
    return { type: QUICK_REPLIES_TYPE, title: data.text, replies };
  }

  image(data) {
    return { type: IMAGE_TYPE, imageUrl: data.image_url };
  }

  card(data) {
    // console.log(data);
    return {
      type: CARD_TYPE,
      title: data.text,
      subtitle: data.text,
      imageUrl: "",
      buttons: data.buttons.map(button => ({
        text: button.title,
      })),
    };
  }
};
