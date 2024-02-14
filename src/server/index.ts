import express from "express";
import http from 'http';
import { WebSocketServer } from 'ws';
import 'dotenv/config';


import {fileURLToPath} from "url";

import apiRoute from './routes/api.js';

import { onConnection } from "./socket-handlers/public-key/PublicKeySocketHandler.js";
import * as sharedKeySocketHandler from "./socket-handlers/shared-key/SocketHandlerSharedKey.js";


//the website's root folder
const STATIC_ROOT = fileURLToPath(import.meta.resolve("../../client-assets/static-root"));
const HTML_ROOT = fileURLToPath(import.meta.resolve("../../client-assets/html"));
const JS_ROOT = fileURLToPath(import.meta.resolve("../client"));

//load .env file

const app = express();
const server = new http.Server(app);
const wss = new WebSocketServer({server});


//set public folder for getting website assets(CSS, Images, Javascript)
app.use("/js", express.static(JS_ROOT));
app.use("/static", express.static(STATIC_ROOT));

//convert request body to JSON automatically
app.use(express.json());

//parse strings that are encoded in URL (example: "%20" is replaced with " ")
app.use(express.urlencoded({extended: true}));


//WebSocket server stuff

//websocket server. handle when new websocket connects to server
//Note that req parameter is the request from ws:// protocol, not http:// protocol
wss.on('connection', (ws, req) => {

  //weird way to get query parameters, but that's how the NodeJS docs stated to parse this url.
  //the protocol can be any value (http:// ws:// etc) since we only care about the search parametes in the URL
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
app.use("/api", apiRoute);


app.use("/", (req, res, next) => {
  console.log("Request Made");
  next();
});

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


server.listen(3000, () => {
  console.log("Server Started!");
})