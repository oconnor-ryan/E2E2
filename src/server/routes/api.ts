import express, { Request } from 'express';

//local files
import { getToken, verifyToken } from '../util/jwt.js';
import { createAccount } from '../util/database.js';
import { login } from '../util/login.js';

const router = express.Router();

const SESSION_COOKIE = "session_cookie";


//these route handlers do not require a JWT since users with no accounts
//must be able to create accounts and log in.


router.post("/create-account", async (req, res) => {
  let {username, auth_pub_key_base64, signature_base_64} = req.body;

  //if unable to create account
  if(!(await createAccount(username, auth_pub_key_base64))) {
    return res.json({error: "Failed to create account!"});
  }

  //if unable to login.
  //consider using SQL rollback to delete account if login does not work
  if(!(await login(username, signature_base_64))) {
    return res.json({error: "Created account, but could not log you in!"});
  }

  //append JWT to session cookie
  req.cookies[SESSION_COOKIE] = getToken({username: username});

  res.json({error: null, success: true})


});

router.post("/login", async (req, res) => {
  let {username, signature_base_64} = req.body;

  //if user cannot log in
  if(!(await login(username, signature_base_64))) {
    return res.json({error: "Created account, but could not log you in!"});
  }

  //append JWT to session cookie
  req.cookies[SESSION_COOKIE] = getToken({username: username});

  res.json({error: null, success: true})
});

//all route handlers after this one must have a valid JWT to be used,
//so we check the validity of the JWT here
router.use("/", (req, res, next) => {
  let sessionCookie = req.cookies[SESSION_COOKIE];
  if(sessionCookie === undefined) {
    res.json({error: "You are not logged in!"});
    res.send(403);
    return;
  }

  let username = verifyToken(sessionCookie);
  if(!username) {
    res.json({error: "You login session has expired!"});
    res.send(403);
  }

  //now that JWT was checked to be valid,
  //move on to next middleware below this route handler
  next();
});


export default router;