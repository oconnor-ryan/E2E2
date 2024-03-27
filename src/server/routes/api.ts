import express from 'express';

//local files
import {createAccount, searchUsers, getUserKeys, getUserPasswordHashAndSalt } from '../util/database.js';
import { ErrorCode } from '../../client/shared/Constants.js';

//routes
import testRoute from './tests.js';
import chatRoute from "./chat.js";
import { hashPassword, passwordCorrect } from '../util/password-hash.js';

const router = express.Router();



//routes

router.use("/test", testRoute)


//these route handlers do not require a JWT since users not logged in
//must be able to create accounts and/or log in.


router.post("/create-account", async (req, res) => {
  const {
    username, 
    password,
    id_pubkey_base64, 
    exchange_pubkey_base64,
    exchange_pubkey_sig_base64,
    exchange_prekey_pubkey_base64,
    exchange_prekey_pubkey_sig_base64
  } = req.body;

  //validate username format

  //required since Basic scheme for Authorization HTTP header
  //concatenates: username + ":" + password. 
  //Thus, username cannot contain any colons, otherwise the username
  //and password cannot be found.
  if((username as string).includes(":")) {
    return res.json({error: ErrorCode.INVALID_USERNAME_FOR_ACCOUNT});
  }

  let {hash, salt} = await hashPassword(password);

  //if unable to create account
  if(!(await createAccount(
    username, 
    hash,
    salt,
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
  let authHeader = req.get('authorization');
  if(!authHeader) {
    return res.status(403).json({error: ErrorCode.NO_AUTH_HEADER});
  }


  //parse Authorization header using Basic scheme 
  // Authorization: Basic Base64-Encoded(<username>:<password>)
  let spaceDelimIndex = authHeader.indexOf(' ');
  let authScheme = authHeader.substring(0, spaceDelimIndex).trim();

  if(authScheme.toLowerCase() !== 'basic') {
    return res.status(403).json({error: ErrorCode.INVALID_AUTH_SCHEME});
  }

  let userAndPasswordBase64 = authHeader.substring(spaceDelimIndex+1).trim();
  let userAndPasswordDecoded = Buffer.from(userAndPasswordBase64, 'base64').toString('utf-8');


  let colonDelimIndex = userAndPasswordDecoded.indexOf(":");
  let userId = userAndPasswordDecoded.substring(0, colonDelimIndex);
  let password = userAndPasswordDecoded.substring(colonDelimIndex+1);

  //get user password hash and salt
  let creds = await getUserPasswordHashAndSalt(userId);
  if(!creds) {
    return res.json({error: ErrorCode.NO_USER_EXISTS});
  }

  //if invalid password
  if(!(await passwordCorrect(password, creds.hashBase64, creds.saltBase64))) {
    return res.json({error: ErrorCode.WRONG_PASSWORD});
  }

  //user is now authenticated!

  //res.locals can be used to pass parameters down from this middleware
  //to the next one. This variable will remain alive until a response is sent
  res.locals.username = userId;

  //now that JWT was checked to be valid,
  //move on to next middleware below this route handler
  next();
});

//since user is logged in, they are now allowed to access
//chat route
router.use("/chat", chatRoute);

router.post("/searchusers", async (req, res) => {
  let currentUser = res.locals.username as string;

  console.log(currentUser);

  let searchResults = await searchUsers(req.body.search, 10, currentUser);

  res.json({error: null, users: searchResults});
});



router.get("/getuserkeys", async (req, res) => {
  const {username} = req.body;

  if(!username) {
    return res.json({error: ErrorCode.NO_USER_PROVIDED});
  }

  let keys = await getUserKeys(username);
  if(!keys) {
    return res.json({error: ErrorCode.CANNOT_GET_USER_KEYS});
  }
  
  return res.json({error: null, keys: keys});
});



export default router;