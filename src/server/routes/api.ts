import express, { Response } from 'express';

//local files
import { acceptInvite, createAccount, createChat, getChatInfo, getChatsOfUser, getInvitesForUser, getIdentityKey, inviteUserToChat, searchUsers, getUserKeys, getUserKeysForChat, addKeyExchange, getLatestMessages } from '../util/database.js';
import { ErrorCode } from '../../client/shared/Constants.js';
import { verifyKey } from '../util/webcrypto/ecdsa.js';

//routes
import testRoute from './tests.js';
import chatRoute from "./chat.js";

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