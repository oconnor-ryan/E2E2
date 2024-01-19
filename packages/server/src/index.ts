import express from "express";
import http from 'http';
import { WebSocketServer } from 'ws';


import path from "path";
import {fileURLToPath} from "url";
import { UserList } from "./UserList.js";
import { parseSocketMessage } from "./socket-parser.js";

import * as c from '@project/client';
import { WebSocketMessages } from "@project/shared";



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



const userList = new UserList();


//set public folder for getting website assets(HTML, CSS, Images, Javascript)
app.use(express.static(ROOT));

//convert request body to JSON automatically
app.use(express.json());

//parse strings that are encoded in URL (example: "%20%" is replaced with " ")
app.use(express.urlencoded({extended: true}));



//websocket
wss.on('connection', (ws, req) => {
  ws.send(JSON.stringify({type: "server", user: "Server", data: 'WebSocket Connection Successful!'}));

  //let newly connected user know about all users in chat
  //before their name is processed
  ws.send(JSON.stringify({type: "update-users", allUsers: userList.getAllUsers()}));

  ws.on('error', console.error);

  ws.on('message', (data, isBinary) => {
    console.log(`recieved ${data}`);
    let parsedData = JSON.parse(data.toString('utf-8'));
    parseSocketMessage(parsedData, ws, wss, isBinary, userList);

  });
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