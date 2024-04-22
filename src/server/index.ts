import express from "express";
import type {ErrorRequestHandler} from "express";
import https from 'https';
import fs from 'fs';
import path from 'path';

import { WebSocketServer } from 'ws';
import 'dotenv/config';


import {fileURLToPath} from "url";

import { onConnection } from "./socket-handlers/MainSocketHandler.js";

import apiRoute from './routes/api.js';


import { getUsernameAndPasswordFromWebSocketQuery } from "./util/auth-parser.js";
import { checkIfUserPasswordCorrect, getUserIdentityForWebSocket } from "./util/database-handler.js";

//GLOBALS HERE

//extend types of global
declare global {
  var ROOT_PROJECT_DIR: string
  var CHAT_UPLOAD_DIR: string
}

global.ROOT_PROJECT_DIR = path.join(fileURLToPath(import.meta.url), "..", "..", "..");
console.log(global.ROOT_PROJECT_DIR);
global.CHAT_UPLOAD_DIR = path.join(global.ROOT_PROJECT_DIR, "chat_file_uploads");
console.log(global.CHAT_UPLOAD_DIR);




//GLOBALS END HERE

//the website's root folder
const STATIC_ROOT = fileURLToPath(import.meta.resolve("../../client-assets/static-root"));
const HTML_ROOT = fileURLToPath(import.meta.resolve("../../client-assets/html"));
const JS_ROOT = fileURLToPath(import.meta.resolve("../client"));

//load https keys
const PRIVATE_KEY = fs.readFileSync("./https-keys/MyKey.key");
const CERTIFICATE = fs.readFileSync("./https-keys/MyCertificate.crt");

const app = express();

const server = new https.Server({key: PRIVATE_KEY, cert: CERTIFICATE}, app);
const wss = new WebSocketServer({server});

//convert request body to JSON automatically
app.use(express.json());

//parse strings that are encoded in URL (example: "%20" is replaced with " ")
app.use(express.urlencoded({extended: true}));


//WebSocket server stuff

//websocket server. handle when new websocket connects to server
//Note that req parameter is the request from ws:// protocol, not http:// protocol
wss.on('connection', onConnection);

wss.on('error', (error) => {
  console.error("failed to create web socket server!");
  console.error(error);
});

//Warning!, upgrades via HTTP can only be done via GET requests
// authenticate user here for websocket
server.on('upgrade', (request, socket, head) => {
  let searchParams = new URL(request.url!, request.headers.host).searchParams;

  const onSocketError = (e: Error) => {console.error(e)}; 

  socket.on('error', onSocketError);

  const destroySocket = () => {
    //https://www.w3.org/Protocols/rfc2616/rfc2616-sec6.html
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }

  //immediately invoked async function allows us to use async await syntax without
  //worry about syncrounous event handler
  (async () => {
    let {username, password} = getUsernameAndPasswordFromWebSocketQuery(searchParams.get('credential') as string);

    let isCorrect = await checkIfUserPasswordCorrect(username, password);
    if(!isCorrect) {
      return destroySocket();
    }

    let acc = await getUserIdentityForWebSocket(username);

    socket.removeListener('error', onSocketError);

    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit('connection', ws, request, acc);
      console.log(`upgrading to websocket`);
    });

  })().catch(e => {
    console.error(e);
    destroySocket();
  });
});

//routes
app.use("/api", apiRoute);


//webpages and static resources

//set public folder for getting website assets(CSS, Images, Javascript)
app.use("/js", express.static(JS_ROOT));
app.use("/static", express.static(STATIC_ROOT));

app.get("/favicon.ico", (req, res) => {
  res.sendFile("favicon.ico", {root: STATIC_ROOT});
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

app.get("/test/account", (req, res) => {
  res.sendFile("account.html", {root: HTML_ROOT});
});

app.get("/test/chatlist", (req, res) => {
  res.sendFile("chat-list.html", {root: HTML_ROOT});
});

app.get("/test/chatroom", (req, res) => {
  res.sendFile("chat-room.html", {root: HTML_ROOT});
});

app.get("/test/callroom", (req, res) => {
  res.sendFile("call-room.html", {root: HTML_ROOT});
});

// 404 error handler
app.use((req, res, next) => {
  res.status(404).sendFile("404.html", {root: HTML_ROOT});
});

// 500 server error handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).sendFile("index.html", {root: HTML_ROOT});
}
app.use(errorHandler);

//use port 3000 to have client use indexeddb for old service
//use port 3100 to have client use indexeddb for new service

server.listen(3100, () => {
  console.log("Server Started!");
})