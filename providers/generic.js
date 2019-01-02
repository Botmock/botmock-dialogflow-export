/**
 * There are 4 generic message types:
 *
 * Text
 * Image
 * Card
 * Quick Reply
 */

import Provider from './provider';

export default class Generic extends Provider {
  text(data) {
    /*
    * data should look something like:
    *   {
    *     text: <text>,
    *   }
    */

    return {
      platform: this.platform_name,
      speech: data.text,
      type: 0,
    }
  }

  image(data) {
    /*
    * data should look something like:
    *   {
    *     image: <url>,
    *   }
    */

    return {
      platform: this.platform_name,
      imageUrl: data.image,
      type: 3,
    }
  }

  card(data) {
    /*
    * data should look something like:
    *   {
    *     buttons: [text, text],
    *     image: imageURL,
    *     subtitle: subtitle,
    *     title: title,
    *   }
    */

    return {
      platform: this.platform_name,
      imageUrl: data.image,
      buttons: data.buttons || [],
      subtitle: data.subtitle || "",
      title: data.title || "",
      type: 1,
    }
  }

  quick_replies(data) {
    /*
    * data should look something like:
    *   {
    *     quick_replies: [text, text],
    *     text: text
    *   }
    */

    return {
      platform: this.platform_name,
      replies: data.quick_replies || [],
      title: data.text || "",
      type: 2,
    }
  }
}
