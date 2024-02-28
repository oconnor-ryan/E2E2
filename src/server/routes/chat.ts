import express from "express";
import { acceptInvite, addKeyExchange, createChat, getChatInfo, getChatsOfUser, getInvitesForUser, getKeyExchanges, getLatestMessages, getUserKeysForChat, inviteUserToChat, userInChat } from "../util/database.js";
import { ErrorCode } from "src/client/shared/Constants.js";

const router = express.Router();


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

  let {chatId} = req.body;

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

router.get("/chatmessages", async (req, res) => {
  let currentUser = res.locals.username as string;
  let chatId = res.locals.chatId as number;

  let {numMessages} = req.body;

  let messages = await getLatestMessages(chatId, numMessages);

  if(!messages) {
    return res.json({error: ErrorCode.FAILED_TO_GET_MESSAGES});
  }

  return res.json({error: null, messages: messages});

});

router.get("/getuserkeysfromchat", async (req, res) => {
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

  let exchangeSent = await addKeyExchange(currentUser, chatId, memberKeyList);

  if(!exchangeSent) {
    return res.json({error: ErrorCode.FAILED_TO_ADD_KEY_EXCHANGE});
  }

  return res.json({error: null});
});

router.get("/getkeyexchangeforchat", async (req, res) => {
  const currentUser = res.locals.username as string;
  const chatId = res.locals.chatId as number;

  let result = await getKeyExchanges(currentUser, chatId);

  if(!result) {
    return res.json({error: ErrorCode.FAILED_TO_RETRIEVE_KEY_EXCHANGES});
  }

  return res.json({error: null, result: result});
});

export default router;