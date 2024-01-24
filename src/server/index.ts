import express from "express";
import http from 'http';
import { WebSocketServer } from 'ws';


import {fileURLToPath} from "url";

import * as JsonValidator from "../client/shared/JSON-Validator.js"
console.log(JsonValidator.jsonContainsThesePropsWithTypes({a: 4}, {a: "number"}));

//should run this in a build script instead of web server script
//c.putDistFilesInDir(fileURLToPath(import.meta.resolve('../dist/client-dist')));

import { onConnection } from "./socket-handlers/public-key/PublicKeySocketHandler.js";
import * as sharedKeySocketHandler from "./socket-handlers/shared-key/SocketHandlerSharedKey.js";


//the website's root folder
const STATIC_ROOT = fileURLToPath(import.meta.resolve("../../client-assets/public"));
const HTML_ROOT = fileURLToPath(import.meta.resolve("../../client-assets/html"));
const JS_ROOT = fileURLToPath(import.meta.resolve("../client"));

console.log(STATIC_ROOT);
console.log(HTML_ROOT);
console.log(JS_ROOT);

const app = express();
const server = new http.Server(app);
const wss = new WebSocketServer({server});


//set public folder for getting website assets(CSS, Images, Javascript)
app.use("/js", express.static(JS_ROOT));
app.use("/", express.static(STATIC_ROOT));

//convert request body to JSON automatically
app.use(express.json());

//parse strings that are encoded in URL (example: "%20" is replaced with " ")
app.use(express.urlencoded({extended: true}));


//WebSocket server stuff

//websocket server. handle when new websocket connects to server
//Note that req parameter is the request from ws:// protocol, not http:// protocol
wss.on('connection', (ws, req) => {

  //weird way to get query parameters, but that's how the NodeJS docs stated to parse this url.
  //make sure to change ws:// to wss:// when using SSL certificates
  let url = new URL(req.url!, "ws://" + req.headers.host);
  let chatType = url.searchParams.get('enc_type')

  switch(chatType) {
    //shared key
    case 'shared':
      sharedKeySocketHandler.onConnection(ws, req, url.searchParams);
      break;

    //public key
    case 'public':
      onConnection(ws, req);
      break;
    default:
      ws.close(undefined, `This encryption protocol ${chatType} is not supported!`);
      break;

  }
  
});


wss.on('error', (error) => {
  console.error("failed to create web socket server!");
  console.error(error);
});

//Warning!, upgrades via HTTP can only be done via GET requests
// authenticate user here for websocket
server.on('upgrade', (request, socket, head) => {
  //let user = new URL(request.url!, request.headers.host).searchParams.get('user') as string;
  /*
  if(!auth) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  */
  console.log(`upgrading to socket`);
});

//routes

app.use("/", (req, res, next) => {
  console.log("Request Made");
  next();
});

app.get("/", (req, res) => {
  res.sendFile("index.html", {root: HTML_ROOT});
});

app.get("/test/chat", (req, res) => {
  res.sendFile("chat.html", {root: HTML_ROOT});
});

app.get("/test/key-derivation", (req, res) => {
  res.sendFile("PBKDF2.html", {root: HTML_ROOT});
});

app.get("/test/public-key", (req, res) => {
  res.sendFile("Public-Key.html", {root: HTML_ROOT});
});


server.listen(3000, () => {
  console.log("Server Started!");
})