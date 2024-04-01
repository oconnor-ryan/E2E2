import http from 'http';
import { WebSocket } from 'ws';

import { getUserPasswordHashAndSalt } from '../../util/database.js';
import { passwordCorrect } from '../../util/password-hash.js';
import { ErrorCode } from '../../../client/shared/Constants.js';


const onlineUsers: {callerId: string, onCall: boolean, ws: WebSocket}[] = [];

interface CallMessage {
  type: 'sdp' | 'icecandidate' | 'callsuccess' | 'callend',
  ownerId: string,
  otherId: string,
  bePolite: boolean
}

export async function onConnection(ws: WebSocket, req: http.IncomingMessage, reqParams: URLSearchParams) {

  let callerId = reqParams.get("userId") as string;
  let authToken = reqParams.get("authtoken") as string;

  console.log(callerId);
  
  if(!callerId) {
    return ws.close(undefined, ErrorCode.NO_USER_PROVIDED);

  }

  if(!authToken) {
    return ws.close(undefined, ErrorCode.WRONG_PASSWORD);

  }

  //TODO: Do not use password as auth token. Use a generated one-time token.
  //this is because a user's password can accidentally be logged by the server or hosting provider.

  //get user password hash and salt
  let creds = await getUserPasswordHashAndSalt(callerId);
  if(!creds) {
    return ws.close(undefined, ErrorCode.NO_USER_EXISTS);
  } 


  if(!(await passwordCorrect(decodeURIComponent(authToken), creds.hashBase64, creds.saltBase64))) {
    return ws.close(undefined, ErrorCode.WRONG_PASSWORD);
  }


  //dont add duplicate users
  if(onlineUsers.find((val) => val.callerId === callerId)) {
    return ws.close(undefined, ErrorCode.USER_ALREADY_EXISTS);

  }



  //add user to online user list
  onlineUsers.push({callerId: callerId, onCall: false, ws: ws});

  let values = onlineUsers.map(val => {
    return {
      callerId: val.callerId
    };
  });

  onlineUsers.forEach((user) => {
    console.log(values);
    user.ws.send(JSON.stringify({type: "userlist", users: values}));
  })


  ws.on('close', (code, reason) => {
    //remove user from online user list
    let userIndex = onlineUsers.findIndex((val) => val.ws === ws);
    if(userIndex >= 0) {
      onlineUsers.splice(userIndex, 1);
    }
  });

  ws.on('error', console.error);


  ws.on('message', (data, isBinary) => {
    console.log(`recieved ${data}`);

    let jsonData = JSON.parse(data.toString('utf-8')) as CallMessage;
    
    let ownerObjectIndex = onlineUsers.findIndex((val) => val.callerId === jsonData.ownerId);

    let otherObjectIndex = onlineUsers.findIndex((val) => val.callerId === jsonData.otherId);

    //if the callee is not online or the caller is trying to call themselves
    if(ownerObjectIndex === -1 || otherObjectIndex === -1 || ownerObjectIndex === otherObjectIndex) {
      return ws.send(JSON.stringify({error: ErrorCode.USER_NOT_AVAILABLE}));
    }

    let ownerObject = onlineUsers[ownerObjectIndex];
    let otherObject = onlineUsers[otherObjectIndex];


    let receiverSocket = otherObject.ws;

    switch(jsonData.type) {
      //called AFTER a peer-to-peer connection is established
      case 'callsuccess':
        ownerObject.onCall = true;
        otherObject.onCall = true;
        break;

      //called after a peer-to-peer connection is broken
      case 'callend': 
        ownerObject.onCall = false;
        otherObject.onCall = false;
        break;
      default:
        //don't send messages if either client is on call
        if(ownerObject.onCall || otherObject.onCall) {
          return;
        }

        //whoever joined the server first must be polite.
        jsonData.bePolite = ownerObjectIndex > otherObjectIndex;

        receiverSocket.send(JSON.stringify(jsonData), {binary: false});
        break;
    }


  });
}
