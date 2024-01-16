import express from "express";
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

import path from "path";
import {fileURLToPath} from "url";

//since __dirname is not supported in EJS modules, 
//set it yourself with the following code.
//This path is relative to the directory where the server index.js is at.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

//the website's root folder
const ROOT = path.join(__dirname, "../client"); 

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
wss.on('connection', (ws, req) => {
  ws.send(JSON.stringify({user: "Server", data: 'WebSocket Connection Successful!'}));

  ws.on('error', console.error);
  ws.on('message', (data, isBinary) => {
    console.log(`recieved ${data}`);

    //send message to all connected clients except this server's client
    wss.clients.forEach((client) => {
      if(client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, {binary: isBinary});
      }
    });

  });
});

wss.on('error', (error) => {
  console.error("failed to create web socket server!");
  console.error(error);
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