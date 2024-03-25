import express from "express";
import multer from "multer";
import fs from 'fs';
import path from 'path';

import { acceptInvite, addKeyExchange, createChat, getChatInfo, getChatsOfUser, getInvitesForUser, getKeyExchanges, getLatestMessages, getUserKeysForChat, inviteUserToChat, userInChat, saveFileToDatabase, fileInChat } from "../util/database.js";
import { ErrorCode } from "../../client/shared/Constants.js";

const router = express.Router();

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, global.CHAT_UPLOAD_DIR);
  },

  //every filename becomes a random uuid
  filename: (req, file, cb) => {
    const uuid = crypto.randomUUID();
    cb(null, uuid);
  }
});

const upload = multer({storage: uploadStorage});

router.post("/createchat", async (req, res) => {
  let currentUser = res.locals.username as string;

  let {invitees} = req.body;

  if(!invitees || !Array.isArray(invitees)) {
    invitees = [];
  }

  let chatId = await createChat(currentUser, ...invitees);

  if(!chatId) {
    return res.json({error: ErrorCode.CHAT_CREATION_FAILED});
  }

  return res.json({error: null, chat: {id: chatId, invitedUsers: invitees}});
});

router.post("/getchats", async (req, res) => {
  let currentUser = res.locals.username as string;

  let result = await getChatsOfUser(currentUser);

  if(result === null) {
    return res.json({error: ErrorCode.CHAT_LIST_RETRIEVE_FAILED});
  }

  return res.json({error: null, chats: result});
});



router.post("/getinvites", async (req, res) => {
  let currentUser = res.locals.username as string;

  let result = await getInvitesForUser(currentUser);

  res.json({error: null, invites: result});
});

router.post("/acceptinvite", async (req, res) => {
  let currentUser = res.locals.username as string;

  let {chatId} = req.body;

  if(!chatId) {
    return res.json({error: ErrorCode.NO_CHAT_ID_PROVIDED});
  }

  let isMember = await acceptInvite(currentUser, chatId);

  if(!isMember) {
    return res.json({error: ErrorCode.CHAT_ACCEPT_INVITE_FAILED});
  }

  let chatInfo = await getChatInfo(chatId);

  return res.json({error: null, chat: chatInfo});
});

//middleware to check if a user belongs to the chat
//they claim to be a part of.
router.use("/", async (req, res, next) => {
  let currentUser = res.locals.username;

  let chatId;
  if(req.method === "GET") {
    chatId = req.query.chatId;
  } else {
    chatId = req.body.chatId;
  }

  if(!chatId) {
    return res.json({error: ErrorCode.NO_CHAT_ID_PROVIDED});
  }

  try {
    let isMember = await userInChat(chatId, currentUser);
    if(!isMember) {
      return res.json({error: ErrorCode.NOT_MEMBER_OF_CHAT});
    }
  } catch(e) {
    console.error(e);
    return res.json({error: ErrorCode.CHAT_RETRIEVE_FAILED})
  }

  res.locals.chatId = chatId;

  next();
});


router.post("/invite", async (req, res) => {
  let currentUser = res.locals.username as string;
  let chatId = res.locals.chatId as number;

  let {user} : {user?: string} = req.body;



  if(!user) {
    return res.json({error: ErrorCode.NO_USER_EXISTS});
  }

  let inviteSuccess = await inviteUserToChat(currentUser, user, chatId);

  if(!inviteSuccess) {
    return res.json({error: ErrorCode.CHAT_INVITE_FAILED});
  }

  return res.json({error: null});

});



router.post("/getchatinfo", async (req, res) => {
  let currentUser = res.locals.username as string;
  let chatId = res.locals.chatId as number;

  let result = await getChatInfo(chatId);
  if(!result) {
    return res.json({error: ErrorCode.CHAT_RETRIEVE_FAILED});
  }


  return res.json({error: null, chatInfo: result})
});

router.post("/chatmessages", async (req, res) => {
  let currentUser = res.locals.username as string;
  let chatId = res.locals.chatId as number;

  let {numMessages, currentKeyExchangeId, lastReadMessageUUID} = req.body;

  let messages = await getLatestMessages(chatId, lastReadMessageUUID, currentKeyExchangeId, numMessages);

  if(!messages) {
    return res.json({error: ErrorCode.FAILED_TO_GET_MESSAGES});
  }

  return res.json({error: null, messages: messages});

});

router.post("/getuserkeysfromchat", async (req, res) => {
  let chatId = res.locals.chatId as number;


  let keys = await getUserKeysForChat(chatId);
  if(!keys) {
    return res.json({error: ErrorCode.CANNOT_GET_USER_KEYS});
  }
  
  return res.json({error: null, keys: keys});
});

router.post("/sendkeyexchangetochat", async (req, res) => {
  const currentUser = res.locals.username as string;
  let chatId = res.locals.chatId as number;

  const {memberKeyList} = req.body;

  let exchangeId = await addKeyExchange(currentUser, chatId, memberKeyList);

  if(!exchangeId) {
    return res.json({error: ErrorCode.FAILED_TO_ADD_KEY_EXCHANGE});
  }

  return res.json({error: null, keyExchangeId: exchangeId});
});

router.post("/getkeyexchangeforchat", async (req, res) => {
  const currentUser = res.locals.username as string;
  const chatId = res.locals.chatId as number;

  let result = await getKeyExchanges(currentUser, chatId, req.body.currentKeyExchangeId);

  if(!result) {
    return res.json({error: ErrorCode.FAILED_TO_RETRIEVE_KEY_EXCHANGES});
  }

  return res.json({error: null, result: result});
});

router.post("/uploadfile", async (req, res) => {
  const chatId = res.locals.chatId as number;

  let filename;
  try {
    filename = await (async () => {
      return new Promise<string>((resolve, reject) => {

        //Multer does not have use Promises for async operations, so
        //I used this wrapper.
        upload.single('uploadedFile')(req, res, (err) => {
          /*
          if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            reject(err);
          } else if (err) {
            // An unknown error occurred when uploading.
            reject(err)
          }
          */
          if(err) {
            return reject(err);
          }
      
          //file was saved successfully
          let filename = req.file?.filename;
          if(!filename) {
            return reject(new Error("File not saved!"));
          }
  
          resolve(filename);
        });
      });
    })();
  } catch(e) {
    console.error(e);
    return res.json({error: ErrorCode.FAILED_TO_PROCESS_FILE_DURING_UPLOAD});
  }
  
  let savedDBEntry = await saveFileToDatabase(filename, chatId);


  if(savedDBEntry) {
    return res.json({error: null})
  } else {
    res.json({error: ErrorCode.FAILED_TO_SAVE_FILE_INFO_DATABASE});
  }

});

router.post("/getfile", async (req, res) => {
  const chatId = res.locals.chatId as number;

  let { filename } = req.body;

  if(!(await fileInChat(filename, chatId))) {
    return res.json({error: ErrorCode.NOT_MEMBER_OF_CHAT});
  }

  let fileStream = fs.createReadStream(path.resolve(global.CHAT_UPLOAD_DIR + path.sep + filename));

  //this may be called multiple times when new data is written to the buffer
  fileStream.on('readable', () => {
    let chunk;
    while((chunk = fileStream.read()) !== null) {
      res.write(chunk);
    }
  });
  
  fileStream.on('end', () => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.status(200).end();
  });

});

export default router;
