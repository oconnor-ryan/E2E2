import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {ErrorRequestHandler} from "express";


//local files
import * as db from '../util/database-handler.js';

import { ErrorCode } from '../../client/shared/Constants.js';
import federatedRoute from './federated.js';

//routes
import { getUsernameAndPasswordFromAuthHeader } from '../util/auth-parser.js';

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

const router = express.Router();



//routes
router.use("/federated", federatedRoute);


//these route handlers do not require a JWT since users not logged in
//must be able to create accounts and/or log in.

//note that async route handlers in Express 4 will prevent thrown errors from using the 
//defined error handling middleware you made UNLESS you call next(err) manually during the 
//async call. Thus, make sure to try-catch or use Promise.catch to call next(err) explicitly
router.post("/create-account", async (req, res, next) => {
  //if unable to create account
  try {
    await db.createAccount(req.body)
  } catch(e) {
    return next(e);
  }

  res.json({error: null})
});

//allow these endpoints to stay unauthenticated to allow remote servers to use them

router.get("/getuserkeysforexchange", async (req, res, next) => {
  const {username} = req.query;

  if(!username) {
    return next(new Error(ErrorCode.NO_USER_PROVIDED));
  }

  let accountInfo;
  try {
    accountInfo = await db.getAccountInfoForExchange(String(username));
    if(!accountInfo) {
      return res.json({}); //return empty json
    }
    return res.json(accountInfo);

  } catch(e) {
    next(e);
  }
});

router.get("/getuserkeys", async (req, res, next) => {
  const {username} = req.query;

  if(!username) {
    return next(new Error(ErrorCode.NO_USER_PROVIDED));
  }

  let accountInfo;
  try {
    accountInfo = await db.getAccountInfo(String(username));
    if(!accountInfo) {
      return res.json({}); //return empty json
    }
    return res.json(accountInfo);

  } catch(e) {
    next(e);
  }
});

router.get("/searchusers", async (req, res, next) => {
  console.log(req.query);
  if(!req.query.search) {
    return res.json([]);
  }

  try {
    let searchResults = await db.searchForUsers(String(req.query.search), 10);
    res.json(searchResults);
  } catch(e) {
    next(e);
  }
  
});

router.get("/getfile", async (req, res, next) => {
  let fileuuid = req.query.fileuuid as string;
  let accessToken = req.query.accesstoken as string;
  
  if(!fileuuid || !accessToken) {
    return next(new Error(ErrorCode.MISSING_QUERY_PARAMETER));
  }

  try {
    let hasAccess = await db.verifyAccessToFile({fileUUID: fileuuid, accessToken: accessToken});
    if(!hasAccess) {
      throw new Error(ErrorCode.NOT_ALLOWED_TO_VIEW_FILE)
    }
  } catch(e) {
    return next(e);
  }

  res.setHeader('Content-Type', 'application/octet-stream');

  let fileStream = fs.createReadStream(path.resolve(global.CHAT_UPLOAD_DIR + path.sep + fileuuid));

  //this may be called multiple times when new data is written to the buffer
  fileStream.on('readable', () => {
    let chunk;
    while((chunk = fileStream.read()) !== null) {
      res.write(chunk);
    }
  });
  
  fileStream.on('end', () => {
    res.end();
  });
})




//all route handlers after this one must have a valid JWT to be used,
//so we check the validity of the JWT here
router.use("/", async (req, res, next) => {
  let authHeader = req.get('authorization');
  if(!authHeader) {
    return next(new Error(ErrorCode.NO_AUTH_HEADER));
  }

  try {
    const {username, password} = getUsernameAndPasswordFromAuthHeader(authHeader);

    //if invalid password
    if(!(await db.checkIfUserPasswordCorrect(username, password))) {
      throw new Error(ErrorCode.WRONG_PASSWORD);
    }

    //user is now authenticated!

    let identityKey;
    let info = await db.getUserIdentity(username);
    if(!info) {
      throw new Error(ErrorCode.CANNOT_GET_USER_KEYS);
    }
    identityKey = info.identityKeyPublic;
    //res.locals can be used to pass parameters down from this middleware
    //to the next one. This variable will remain alive until a response is sent
    res.locals.username = username;
    res.locals.identityKey = identityKey;

    //move on to next middleware below this route handler
    next();

  } catch(e) {
    return next(e);
  }
  
});

//since user is logged in, they are now allowed to access
//these endpoints

router.post("/uploadfile", async (req, res, next) => {
  const currentUser = res.locals.username;
  let accessToken = crypto.randomBytes(20).toString('utf-8');

  let fileuuid;
  try {
    fileuuid = await (async () => {
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
  
          let fileuuid = req.file?.filename;
          if(!fileuuid) {
            return reject(new Error("File UUID not made!"));
          }
          
          resolve(fileuuid);
        });
      });
    })();
  } catch(e) {
    console.error(e);
    return next(new Error(ErrorCode.FAILED_TO_PROCESS_FILE_DURING_UPLOAD))
  }

  try {
    await db.saveFile({fileUUID: fileuuid, accessToken: accessToken});
    return res.json({fileUUID: fileuuid, accessToken: accessToken});
  } catch(e) {
    next(e);
  }

})

router.post("/addprekeys", async (req, res, next) => {
  const currentUser = res.locals.username;
  const identityKey = res.locals.identityKey;

  try {
    await db.addPrekeys(identityKey, req.body as string[]);
    return res.json({error: null});
  } catch(e) {
    return next(e);
  }
});

router.get("/getnumprekeys", async (req, res, next) => {
  const currentUser = res.locals.username;
  const identityKey = res.locals.identityKey;

  try {
    let numPrekeys = await db.getNumPrekeys(identityKey);
    return res.json({numPrekeys: numPrekeys});
  } catch(e) {
    return next(e);
  }
});






//404 error handler
router.use((req, res, next) => {
  res.status(404).send();
});

//error handler for API
const errorHandler: ErrorRequestHandler = (err: Error, req, res, next) => {
  console.error(err.stack);
  res.setHeader('Content-Type', 'application/json');
  res.json({error: err.message});
};
router.use(errorHandler);

export default router;