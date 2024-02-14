import express, { Response } from 'express';

//local files
import { acceptInvite, createAccount, createChat, getChatInfo, getChatsOfUser, getInvitesForUser, getIdentityKey, inviteUserToChat, searchUsers } from '../util/database.js';
import { ErrorCode } from '../../client/shared/Constants.js';

import testRoute from './tests.js';
import { verifyKey } from '../util/webcrypto/ecdsa.js';

const router = express.Router();



//routes

router.use("/test", testRoute)


//these route handlers do not require a JWT since users not logged in
//must be able to create accounts and/or log in.


router.post("/create-account", async (req, res) => {
  const {
    username, 
    id_pubkey_base64, 
    exchange_pubkey_base64,
    exchange_pubkey_sig_base64,
    exchange_prekey_pubkey_base64,
    exchange_prekey_pubkey_sig_base64
  } = req.body;

  console.log(req.body);

  //if unable to create account
  if(!(await createAccount(
    username, 
    id_pubkey_base64, 
    exchange_pubkey_base64, 
    exchange_pubkey_sig_base64, 
    exchange_prekey_pubkey_base64, 
    exchange_prekey_pubkey_sig_base64
  ))) {
    return res.json({error: ErrorCode.ACCOUNT_CREATION_FAILED});
  }



  res.json({error: null, success: true})


});


//all route handlers after this one must have a valid JWT to be used,
//so we check the validity of the JWT here
router.use("/", async (req, res, next) => {
  let sig = req.get("E2E2-Body-Signature");
  let userId = req.get("E2E2-User-Id");

  if(!userId) {
    return res.status(403).json({error: ErrorCode.NO_USER_PROVIDED});
  }

  if(!sig) {
    return res.status(403).json({error: ErrorCode.MISSING_HTTP_SIGNATURE});
  }

  let pubKeyBase64 = await getIdentityKey(userId);
  if(!pubKeyBase64) {
    return res.status(403).json({error: ErrorCode.NO_USER_EXISTS});
  }

  console.log(req.body);
  console.log(JSON.stringify(req.body));

  let requestBelongsToUser = await verifyKey(JSON.stringify(req.body), sig, pubKeyBase64);

  if(!requestBelongsToUser) {
    return res.status(403).json({error: ErrorCode.SIGNATURE_DOES_NOT_MATCH_USER});
  }


  //res.locals can be used to pass parameters down from this middleware
  //to the next one. This variable will remain alive until a response is sent
  res.locals.username = userId;

  //now that JWT was checked to be valid,
  //move on to next middleware below this route handler
  next();
});

router.post("/searchusers", async (req, res) => {
  let currentUser = res.locals.username as string;

  console.log(currentUser);

  let searchResults = await searchUsers(req.body.search, 10, currentUser);

  res.json({error: null, users: searchResults});
});

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

router.post("/invite", async (req, res) => {
  let currentUser = res.locals.username as string;

  let {user, chatId} : {user?: string, chatId?: number}  = req.body;

  if(!user) {
    return res.json({error: ErrorCode.NO_USER_EXISTS});
  }


  if(!chatId) {
    return res.json({error: ErrorCode.NO_CHAT_ID_PROVIDED});
  }

  let inviteSuccess = await inviteUserToChat(currentUser, user, chatId);

  if(!inviteSuccess) {
    return res.json({error: ErrorCode.CHAT_INVITE_FAILED});
  }

  return res.json({error: null});

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

  return res.json({error: null});
});

router.post("/getchatinfo", async (req, res) => {
  let currentUser = res.locals.username as string;

  let {chatId} = req.body;
  if(!chatId) {
    return res.json({error: ErrorCode.NO_CHAT_ID_PROVIDED});
  }

  let result = await getChatInfo(chatId);
  if(!result) {
    return res.json({error: ErrorCode.CHAT_RETRIEVE_FAILED});
  }

  let members = result.members;

  if(!members.find((m) => m.id === currentUser)) {
    return res.json({error: ErrorCode.NOT_MEMBER_OF_CHAT});
  }


  return res.json({error: null, chatInfo: result})
});


export default router;