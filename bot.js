const TelegramBot = require("node-telegram-bot-api");
const { MongoClient } = require("mongodb");
const axios = require('axios');
const http = require('http');

// Bot Connection
const token = process.env.BOT_TOKEN;
const ownerId = parseInt(process.env.OWNER_ID, 10)
const Force_Join_Channel = process.env.FORCE_JOIN_CHANNEL;
const bot = new TelegramBot(token, { polling: true });
console.log("Connected To Bot");


// Db Connection
let db;
let usersCollection;
let broadcastHistoryCollection;

MongoClient.connect(process.env.MONGO_URI)
  .then(client => {
    db = client.db("tg-bot");
    usersCollection = db.collection("Users");
    broadcastHistoryCollection = db.collection("Broadcast_History");
    console.log("Connected to MongoDB");
  })
  .catch(error => console.error(error));


getUserIdsFromDB = async () => {
  try {
    const users = await usersCollection.find({}).toArray();
    return users.map(user => user.userId);
  } catch (error) {
    console.error("Error reading user IDs from MongoDB:", error);
    return [];
  }
};

// Helper function to add user ID to MongoDB
const addUserIdToDB = async (userId, firstName) => {
  try {
    await usersCollection.updateOne(
      { userId: userId },
      { $set: { userId: userId, firstName: firstName } },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error adding user ID to MongoDB:", error);
  }
};

// Helper function to get user information
const getUserInfo = async (userId) => {
  try {
    const user = await bot.getChat(userId);
    return user;
  } catch (error) {
    console.error("Error getting user info:", error);
    return null;
  }
};

// Helper function to store broadcast history in MongoDB
const storeBroadcastHistory = async (message, photo, caption, photo_link) => {
  let newBroadcastEntry;
  if (photo !== null) {
    newBroadcastEntry = {
      type: 'Photo',
      caption,
      photo_id: photo,
      photo_link: photo_link,
      date_time: new Date().toLocaleString()
    };
  } else {
    newBroadcastEntry = {
      type: 'Message',
      message,
      date_time: new Date().toLocaleString()
    };
  }

  try {
    await broadcastHistoryCollection.insertOne(newBroadcastEntry);
  } catch (error) {
    console.error('Error writing broadcast history to MongoDB:', error);
  }
};

// Helper function to get the file path of a photo
const getFileLink = async (fileId) => {
  try {
    const response = await bot.getFile(fileId);
    const filePath = response.file_path;
    return `https://api.telegram.org/file/bot${token}/${filePath}`;
  } catch (error) {
    console.error('Error getting file path:', error);
    return null;
  }
};

const getBroadcastHistoryFromDB = async () => {
  try {
    const broadcastHistory = await broadcastHistoryCollection.find({}).toArray();
    return broadcastHistory;
  } catch (error) {
    console.error("Error reading broadcast history from MongoDB:", error);
    return [];
  }
};


const setWebhook = async (botToken, webhookUrl) => {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      url: webhookUrl
    });
    return response.data;
  } catch (error) {
    console.error('Error setting webhook:', error);
    return null;
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstname = msg.from.first_name;

  bot.sendChatAction(chatId, "upload_photo");

  const users = await getUserIdsFromDB()

  if (!users.includes(userId.toString())) {
    await addUserIdToDB(userId, firstname);
  }
    bot.sendPhoto(chatId, "https://t.me/FLIXPLPLOGOS/318", {
      caption: `<b>Hey, <a href='tg://user?id=${userId}'>${firstname}</a>\n\ntype /cmds to check commands</b>`,
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
      reply_markup: JSON.stringify({
        inline_keyboard: [[{ text: "𝗢𝗪𝗡𝗘𝗥", url: `tg://user?id=${ownerId}` }]],
        resize_keyboard: true,
      }),
    });
});

// Handling the /cmds command
bot.onText(/\/cmds/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendChatAction(chatId, "typing");

  bot.getChatMember(Force_Join_Channel, userId).then((response) => {
   const status = response.status;
    if (status !== "member" && status !== "creator") {
      bot.sendMessage(
        chatId,
        "<b>Please join our channel to access this feature.</b>",
        {
          parse_mode: "HTML",
          reply_to_message_id: msg.message_id,
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: "𝗝𝗢𝗜𝗡 𝗖𝗛𝗔𝗡𝗡𝗘𝗟", url: "https://t.me/+Gh5Cq7m-V003ZjY1" }],
              [{ text: "𝗖𝗵𝗲𝗰𝗸 𝗦𝘁𝗮𝘁𝘂𝘀", callback_data: "force_join" }],
            ],
            resize_keyboard: true,
          }),
        }
      );
    } else {
      bot.sendMessage(chatId, "<b>What You Want to Check</b>", {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "𝗖𝗛𝗘𝗖𝗞 𝗖𝗛𝗔𝗧 𝗜𝗗", callback_data: "id" }],
            [{ text: "𝗢𝗪𝗡𝗘𝗥 𝗖𝗠𝗗𝗦", callback_data: "Ownercmds" }],
          ],
          resize_keyboard: true,
        }),
      });
    }
  });
});

// Handling callback queries
bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const callbackChatId = callbackQuery.message.chat.id;
  const callbackFirstName = callbackQuery.from.first_name;
  const callbackMessageId = callbackQuery.message.message_id;
  const callbackUserId = callbackQuery.from.id;
  const callbackQueryId = callbackQuery.id;


  if (data === "force_join") {
    const response = await bot.getChatMember(Force_Join_Channel, callbackUserId);
    const status = response.status;
    if (status !== "member" && status !== "creator") {
      bot.editMessageText("<b>First Join Then Check</b>", {
        chat_id: callbackChatId,
        message_id: callbackMessageId,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "𝗝𝗢𝗜𝗡 𝗖𝗛𝗔𝗡𝗡𝗘𝗟", url: "https://t.me/+Gh5Cq7m-V003ZjY1" }],
            [{ text: "𝗖𝗵𝗲𝗰𝗸 𝗦𝘁𝗮𝘁𝘂𝘀", callback_data: "force_join" }],
          ],
          resize_keyboard: true,
        }),
      });
    } else {
      bot.editMessageText("<b>What You Want to Check</b>", {
        chat_id: callbackChatId,
        message_id: callbackMessageId,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "𝗖𝗛𝗘𝗖𝗞 𝗖𝗛𝗔𝗧 𝗜𝗗", callback_data: "id" }],
            [{ text: "𝗢𝗪𝗡𝗘𝗥 𝗖𝗠𝗗𝗦", callback_data: "Ownercmds" }],
          ],
          resize_keyboard: true,
        }),
      });
    }
  }

  if (data === "id") {
    bot.editMessageText(
      `<b>ID Lookup ⚡️</b>\n\n✮ 𝗨𝘀𝗲𝗿 𝗜𝗗 ➔ <code>${callbackUserId}</code>\n✮ 𝗚𝗿𝗼𝘂𝗽 𝗜𝗗 ➔ <code>${callbackChatId}</code>\n✮ 𝗨𝘀𝗲𝗿 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 ➔ <a href='tg://user?id=${callbackUserId}'>${callbackFirstName}</a>`,
      {
        chat_id: callbackChatId,
        message_id: callbackMessageId,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "Return", callback_data: "listback" }]],
          resize_keyboard: true,
        }),
      }
    );
  }

  if (data === "Ownercmds") {
    if (callbackUserId === ownerId) {
      bot.editMessageText("<b>What You Want to Check</b>", {
        chat_id: callbackChatId,
        message_id: callbackMessageId,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "𝗨𝗦𝗘𝗥𝗦", callback_data: "Userlist" }],
            [
              { text: "𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧", callback_data: "broadcast" },
              { text: "𝗛𝗜𝗦𝗧𝗢𝗥𝗬 ", callback_data: "broadcast_history" },
            ],
            [{ text: "Return", callback_data: "listback" }],
          ],
          resize_keyboard: true,
        }),
      });
    } else {
      bot.answerCallbackQuery(callbackQueryId, {
        text: "𝗡𝗼𝘁 𝗔𝘂𝘁𝗵𝗼𝗿𝗶𝘀𝗲𝗱",
        show_alert: true,
      });
    }
  }

  if (data === "listback") {
    bot.editMessageText("<b>What You Want to Check</b>", {
      chat_id: callbackChatId,
      message_id: callbackMessageId,
      parse_mode: "HTML",
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: "𝗖𝗛𝗘𝗖𝗞 𝗖𝗛𝗔𝗧 𝗜𝗗", callback_data: "id" }],
          [{ text: "𝗢𝗪𝗡𝗘𝗥 𝗖𝗠𝗗𝗦", callback_data: "Ownercmds" }],
        ],
        resize_keyboard: true,
      }),
    });
  }

  // Userlist callback
  if (data === "Userlist") {
    if (callbackUserId === ownerId) {
      const userIds = await getUserIdsFromDB();
      const userCount = userIds.length;

      if (userCount === 0) {
        bot.editMessageText("<b>NO USERS FOUND 😏</b>", {
          chat_id: callbackChatId,
          message_id: callbackMessageId,
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: "Return", callback_data: "Ownercmds" }]],
            resize_keyboard: true,
          }),
        });
      } else {
        const userChatInfoPromises = userIds.map(async (userId, index) => {
          const user = await getUserInfo(userId);
          if (user && user.username && user.first_name) {
            return `<b>${index + 1}</b> 𝗨𝘀𝗲𝗿 ➔ ${
              user.first_name
            }\n𝗨𝗦𝗘𝗥 𝗜𝗗 ➔ [<code>${userId}</code>]\n𝗨𝗦𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 ➔ @${
              user.username
            }\n`;
          }
          return "";
        });

        const userChatInfo = await Promise.all(userChatInfoPromises);
        const userInfoText = `<b>${userCount}</b> 𝗨𝗦𝗘𝗥𝗦 𝗟𝗜𝗦𝗧 ✅\n\n${userChatInfo
          .filter(Boolean)
          .join("\n\n")}`;

        bot.editMessageText(userInfoText, {
          chat_id: callbackChatId,
          message_id: callbackMessageId,
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: "Return", callback_data: "Ownercmds" }]],
            resize_keyboard: true,
          }),
        });
      }
    } else {

    bot.answerCallbackQuery(callbackQueryId, {
        text: "𝗡𝗼𝘁 𝗔𝘂𝘁𝗵𝗼𝗿𝗶𝘀𝗲𝗱",
        show_alert: true,
      });
    }
  }

if (data === 'broadcast') {
    // Check if the user is authorized
    if (callbackUserId === ownerId) {
      bot.sendChatAction(callbackChatId, 'typing');

      bot.sendMessage(callbackChatId, '𝗣𝗿𝗼𝘃𝗶𝗱𝗲 𝗔 𝗠𝗮𝘀𝘀𝗮𝗴𝗲 𝗧𝗼 𝗕𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁', {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMessage => {
        const replyListenerId = bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (replyMessage) => {
            const broadcastUserIds = await getUserIdsFromDB();

            if (replyMessage.photo) {
              const photo = replyMessage.photo.pop().file_id;
              const caption = replyMessage.caption || '';

              for (const userId of broadcastUserIds) {
                if (userId !== ownerId) {
                  bot.sendPhoto(userId, photo, { caption, parse_mode: 'html' });
                }
              }
              const fileLink = await getFileLink(photo);
              await storeBroadcastHistory(null, photo, caption, fileLink);
              

            } else if (replyMessage.text) {
              const text = replyMessage.text;

              for (const userId of broadcastUserIds) {
                if (userId !== ownerId) {
                  bot.sendMessage(userId, text, { parse_mode: 'html' });
                }
              }
              storeBroadcastHistory(text, null, null, null);
            }

            bot.sendMessage(callbackChatId, '✅ 𝗕𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹 𝗧𝗼 𝗔𝗹𝗹 𝗨𝘀𝗲𝗿𝘀');
            bot.removeReplyListener(replyListenerId); // Remove the reply listener to avoid spam
          }
        );
      });
    } else {
      bot.answerCallbackQuery(callbackQuery.id, {
        text: '𝗡𝗼𝘁 𝗔𝘂𝘁𝗵𝗼𝗿𝗶𝘀𝗲𝗱',
        show_alert: true
      });
    }
  }

if (data === "broadcast_history") {
  const broadcastHistory = await getBroadcastHistoryFromDB();
  
  let historyText = "";
  
  if (broadcastHistory.length > 0) {
    broadcastHistory.forEach((entry, index) => {
        historyText += `<b>${index + 1} Broadcast:</b>\n`;
      
      if (entry.type === 'Message') {
          historyText += `<b>Type ➔ Message\nMessage ➔</b> ${entry.message}\n`;
      } else if (entry.type === 'Photo') {
          historyText += `<b>Type ➔ Photo\nPhoto Link ➔</b> <a href='${entry.photo_link}'>View Photo</a>\n<b>Photo Caption ➔</b> ${entry.caption || ''}\n`;
      }
        historyText += `𝗗𝗮𝘁𝗲 & 𝗧𝗶𝗺𝗲 ↯ ${new Date(entry.date_time).toLocaleString()}\n\n`;
    });

  bot.editMessageText(`<b>Broadcast History:</b>\n\n${historyText}`, {
      chat_id: callbackChatId,
      message_id: callbackMessageId,
      parse_mode: 'HTML',
      reply_markup: JSON.stringify({
    inline_keyboard: [
    [{ text: "𝗗𝗲𝗹𝗲𝘁𝗲 𝗔𝗹𝗹 𝗛𝗶𝘀𝘁𝗼𝗿𝘆", callback_data: "delete_broadcast_history" }],
    [{ text: "Return", callback_data: "Ownercmds" }],
    ],
    resize_keyboard: true,
    }),
    });
    
  } else {
    // If Broadcast History Empty
    bot.editMessageText(`<b>No broadcast history found.</b>`, {
      chat_id: callbackChatId,
      message_id: callbackMessageId,
      parse_mode: 'HTML',
      reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "Return", callback_data: "Ownercmds" }]],
            resize_keyboard: true,
      }),
    });
  }
  }

  if (data === "delete_broadcast_history") {
    // Check if the user is authorized to delete broadcast history (e.g., ownerId)
    if (callbackUserId === ownerId) {
      try {
        await broadcastHistoryCollection.deleteMany({});
   
         
  bot.editMessageText(`<b>All Broadcast History Deleted Successfully</b>`, {
          chat_id: callbackChatId,
          message_id: callbackMessageId,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: "Return", callback_data: "Ownercmds" }]],
            resize_keyboard: true,
          }),
        });
      
      } catch (error) {
        console.error("Error deleting all broadcast history:", error);
        bot.sendMessage(callbackChatId, "An error occurred while deleting broadcast history");
      }
    } else {
      bot.answerCallbackQuery(callbackQueryId, {
        text: "𝗡𝗼𝘁 𝗔𝘂𝘁𝗵𝗼𝗿𝗶𝘀𝗲𝗱",
        show_alert: true,
      });
    }
  }
});


bot.onText(/\/(info|id|me)/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstname = msg.from.first_name;

  bot.sendChatAction(chatId, "typing");
  bot.sendMessage(
    chatId,
    `<b>ID Lookup ⚡️</b>\n\n✮ 𝗨𝘀𝗲𝗿 𝗜𝗗 ➔ <code>${userId}</code>\n✮ 𝗚𝗿𝗼𝘂𝗽 𝗜𝗗 ➔ <code>${chatId}</code>\n✮ 𝗨𝘀𝗲𝗿 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 ➔ <a href='tg://user?id=${userId}'>${firstname}</a>`,
    {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_to_message_id: msg.message_id,
    }
  );
});

// Handling the /ping command
bot.onText(/\/ping/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageId = msg.message_id;
  const startTime = new Date().getTime();

  bot.sendChatAction(chatId, 'typing').then(() => {
    const endTime = new Date().getTime();
    const pingTime = endTime - startTime;

    bot.sendMessage(chatId, `Pong! 🏓\nPing Time: ${pingTime} ms`, {
      reply_to_message_id: messageId
    });
  });
});


bot.onText(/\/setwebhook/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const messageText = msg.text;
    const parts = messageText.split(" ");

    if (parts.length === 3) {
      const initialMessage = await bot.sendMessage(chatId, "𝗦𝗲𝘁𝘁𝗶𝗻𝗴 𝗪𝗲𝗯𝗵𝗼𝗼𝗸... ⏳", {
        reply_to_message_id: messageId
      });

      if (initialMessage) {
        const response = await setWebhook(parts[1], parts[2]);
        let message;

        if (response.ok && response.result) {
          if (response.description === 'Webhook was set') {
            message = '𝗪𝗲𝗯𝗵𝗼𝗼𝗸 𝗦𝗲𝘁𝘂𝗽 𝗜𝘀 𝗗𝗼𝗻𝗲 ⚡';
          } else if (response.description === 'Webhook is already set') {
            message = '𝗪𝗲𝗯𝗵𝗼𝗼𝗸 𝗜𝘀 𝗔𝗹𝗿𝗲𝗮𝗱𝘆 𝗦𝗲𝘁 ✅';
          }
        } else if (response.error_code === 401) {
          message = '𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗕𝗢𝗧 𝗧𝗢𝗞𝗘𝗡 ❌';
        } else if (response.error_code === 400) {
          message = '𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝗪𝗲𝗯𝗵𝗼𝗼𝗸 𝗨𝗥𝗟, 𝗠𝘂𝘀𝘁 𝗕𝗲 𝗛𝗧𝗧𝗣𝗦 𝗨𝗥𝗟 ❌';
        } else {
          message = '𝗨𝗻𝗸𝗻𝗼𝘄𝗻 𝗲𝗿𝗿𝗼𝗿 𝗼𝗰𝗰𝘂𝗿𝗿𝗲𝗱.';
        }

        bot.editMessageText(message, {
          chat_id: initialMessage.chat.id,
          message_id: initialMessage.message_id
        });
      }
    } else {
      bot.sendMessage(chatId, "𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝗙𝗼𝗿𝗺𝗮𝘁 ❌.\n𝗨𝘀𝗲 /setwebhook 𝗕𝗼𝘁𝗧𝗼𝗸𝗲𝗻 𝗪𝗲𝗯𝗵𝗼𝗼𝗸𝗨𝗿𝗹", {
        reply_to_message_id: messageId
      });
    }
  });


const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Alive');
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Bot started on port ${PORT}`);
});
