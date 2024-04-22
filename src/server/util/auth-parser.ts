import { ErrorCode } from "../../client/shared/Constants.js";

export function getUsernameAndPasswordFromAuthHeader(authHeader: string) {
  //parse Authorization header using Basic scheme 
  // Authorization: Basic Base64-Encoded(<username>:<password>)
  let spaceDelimIndex = authHeader.indexOf(' ');
  let authScheme = authHeader.substring(0, spaceDelimIndex).trim();

  if(authScheme.toLowerCase() !== 'basic') {
    throw new Error(ErrorCode.INVALID_AUTH_SCHEME);
  }

  let userAndPasswordBase64 = authHeader.substring(spaceDelimIndex+1).trim();
  let userAndPasswordDecoded = Buffer.from(userAndPasswordBase64, 'base64').toString('utf-8');


  let colonDelimIndex = userAndPasswordDecoded.indexOf(":");
  if(colonDelimIndex === -1) {
    throw new Error(ErrorCode.INVALID_AUTH_SCHEME);
  }
  let username = userAndPasswordDecoded.substring(0, colonDelimIndex);
  let password = userAndPasswordDecoded.substring(colonDelimIndex+1);

  return {
    username: username,
    password: password
  }
  
}

export function getUsernameAndPasswordFromWebSocketQuery(credential: string) {
  //parse using this format: Base64URL-Encode(<username>:<password>)
  let userAndPasswordDecoded = Buffer.from(credential, 'base64url').toString('utf-8');

  let colonDelimIndex = userAndPasswordDecoded.indexOf(":");
  if(colonDelimIndex === -1) {
    throw new Error(ErrorCode.INVALID_AUTH_SCHEME);
  }
  let username = userAndPasswordDecoded.substring(0, colonDelimIndex);
  let password = userAndPasswordDecoded.substring(colonDelimIndex+1);

  return {
    username: username,
    password: password
  }
}