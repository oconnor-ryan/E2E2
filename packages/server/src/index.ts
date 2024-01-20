import express from "express";
import http from 'http';
import { WebSocketServer } from 'ws';


import {fileURLToPath} from "url";

import * as c from '@project/client';

//should run this in a build script instead of web server script
//c.putDistFilesInDir(fileURLToPath(import.meta.resolve('../dist/client-dist')));

import { onConnection } from "./socket-handlers/public-key/PublicKeySocketHandler.js";



//since __dirname is not supported in EJS modules, 
//set it yourself with the following code.
//This path is relative to the directory where the server index.js is at.
//const __dirname = path.dirname(fileURLToPath(import.meta.url));


//the website's root folder
const ROOT = fileURLToPath(c.getStaticFileRoot());
console.log(ROOT);

const app = express();
const server = new http.Server(app);
const wss = new WebSocketServer({server});





//set public folder for getting website assets(HTML, CSS, Images, Javascript)
app.use(express.static(ROOT));

//convert request body to JSON automatically
app.use(express.json());

//parse strings that are encoded in URL (example: "%20%" is replaced with " ")
app.use(express.urlencoded({extended: true}));



//websocket
//Note that req parameter is the request from ws:// protocol, not http:// protocol
wss.on('connection', (ws, req) => {

  //weird way to get query parameters, but that's how the NodeJS docs stated to parse this url.
  //make sure to change ws:// to wss:// when using SSL certificates
  let url = new URL(req.url!, "ws://" + req.headers.host);
  let chatType = url.searchParams.get('enc_type')

  switch(chatType) {
    //shared key
    case 'shared':
      ws.close(undefined, "Shared key chat not implemented yet!");
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
  res.sendFile("index.html", {root: ROOT});
});

app.get("/test/chat", (req, res) => {
  res.sendFile("chat.html", {root: ROOT});
});

app.get("/test/key-derivation", (req, res) => {
  res.sendFile("PBKDF2.html", {root: ROOT});
});

app.get("/test/public-key", (req, res) => {
  res.sendFile("Public-Key.html", {root: ROOT});
});


server.listen(3000, () => {
  console.log("Server Started!");
})