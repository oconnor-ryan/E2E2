import { NextFunction, Request, Response } from "express";
import { ErrorCode } from "../../client/shared/Constants.js";
import { getIdentityKey } from "../util/database.js";
import { verifyKey } from "../util/webcrypto/ecdsa.js";


export async function performUserAuthJSONMiddleware(req: Request, res: Response, next: NextFunction) {
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
}

export async function performUserAuthFileUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  let sig = req.get("E2E2-User-Id-Signature");
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




  let requestBelongsToUser = await verifyKey(userId, sig, pubKeyBase64);

  if(!requestBelongsToUser) {
    return res.status(403).json({error: ErrorCode.SIGNATURE_DOES_NOT_MATCH_USER});
  }


  //res.locals can be used to pass parameters down from this middleware
  //to the next one. This variable will remain alive until a response is sent
  res.locals.username = userId;

  //now that JWT was checked to be valid,
  //move on to next middleware below this route handler
  next();
}