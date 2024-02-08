import express, { Request, Response } from 'express';

//local files
import { getExpDate, getToken, verifyToken } from '../util/jwt.js';
import { acceptInvite, createAccount, createChat, getChatInfo, getChatRoomsWithTheseMembers, getChatRoomsWithTheseMembersOnly, getChatsOfUser, getInvitesForUser, inviteUserToChat, searchUsers } from '../util/database.js';
import { login } from '../util/login.js';
import { NOT_LOGGED_IN_ERROR, NO_USER_EXISTS_ERROR } from '../../client/shared/Constants.js';

import testRoute from './tests.js';

const router = express.Router();

const SESSION_COOKIE = "session_cookie";

//helper functions


//makes it simpler to append JWT to session cookie with correct parameters
function setJWTAsCookie(res: Response, username: string) {
  let jwt = getToken({username: username});

  //append JWT to session cookie 
  //(note that if expires property is null, this is treated as session cookie)
  res.cookie(SESSION_COOKIE, jwt, {
    httpOnly: true, //prevent XSS attack,
    sameSite: 'strict', //keep on same origin
    secure: false //TODO: switch to true when using HTTPS
  });
}

//routes

router.use("/test", testRoute)


//these route handlers do not require a JWT since users not logged in
//must be able to create accounts and/or log in.


router.post("/create-account", async (req, res) => {
  let {username, auth_pub_key_base64, signature_base64} = req.body;

  //if unable to create account
  if(!(await createAccount(username, auth_pub_key_base64))) {
    return res.json({error: "Failed to create account!"});
  }

  //if unable to login with newly generated signing key.
  //consider using SQL rollback to delete account if login does not work
  //or have user regenerate signing key pair and try logging in again
  if(!(await login(username, signature_base64))) {
    return res.json({error: "Created account, but could not log you in!"});
  }

  setJWTAsCookie(res, username);

  res.json({error: null, success: true})


});

router.post("/login", async (req, res) => {
  let {username, signature_base64} = req.body;

  //if user cannot log in
  if(!(await login(username, signature_base64))) {
    return res.json({error: "Created account, but could not log you in!"});
  }

  //append JWT to session cookie
  setJWTAsCookie(res, username);

  res.json({error: null, success: true})
});

//all route handlers after this one must have a valid JWT to be used,
//so we check the validity of the JWT here
router.use("/", (req, res, next) => {
  let sessionCookie = req.cookies[SESSION_COOKIE];
  if(sessionCookie === undefined) {
    res.status(403).json({error: NOT_LOGGED_IN_ERROR});
    return;
  }

  let jwtPayload = verifyToken(sessionCookie);
  if(!jwtPayload) {
    res.status(403).json({error: NOT_LOGGED_IN_ERROR});
    return;
  }

  //res.locals can be used to pass parameters down from this middleware
  //to the next one. This variable will remain alive until a response is sent
  res.locals.username = jwtPayload.username;

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

  let chatId = await createChat(currentUser, invitees);

  if(!chatId) {
    return res.json({error: "Failed to create chat room!"});
  }

  return res.json({error: null, chat: {id: chatId, invitedUsers: invitees}});
});

router.post("/getchats", async (req, res) => {
  let currentUser = res.locals.username as string;

  let result = await getChatsOfUser(currentUser);

  if(result === null) {
    return res.json({error: "Unable to retrieve list of chats for you!"});
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
    return res.json({error: NO_USER_EXISTS_ERROR});
  }

  //if no chatId was supplied, create a new chat only if
  //there does not exist another chat that only consists of the sender
  //and user as members.
  if(!chatId) {
    return res.json({error: "You must create a chat room first to invite people."});
  }

  let inviteSuccess = await inviteUserToChat(currentUser, user, chatId);

  if(!inviteSuccess) {
    return res.json({error: "Failed to invite user"});
  }

  return res.json({error: null});

});

router.post("/acceptinvite", async (req, res) => {
  let currentUser = res.locals.username as string;

  let {chatId} = req.body;

  if(!chatId) {
    return res.json({error: "The chatId parameter is required to accept an invite!"});
  }

  let isMember = await acceptInvite(currentUser, chatId);

  if(!isMember) {
    return res.json({error: "Failed to accept invite!"});
  }

  return res.json({error: null});
});

router.post("/getchatinfo", async (req, res) => {
  let currentUser = res.locals.username as string;

  let {chatId} = req.body;
  if(!chatId) {
    return res.json({error: "The chatId parameter is required!"});
  }

  let result = await getChatInfo(chatId);
  if(!result) {
    return res.json({error: "Unable to retrieve chat info!"});
  }

  let members = result.members;

  if(!members.find((m) => m.id === currentUser)) {
    return res.json({error: "You are not part of this chat and cannot view information about it!"});
  }


  return res.json({error: null, chatInfo: result})
});


export default router;