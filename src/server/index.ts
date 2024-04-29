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

//This does not work for authenticating users because the 'connection' event is called
//BEFORE this upgrade request (which will only work in HTTP/1.1)
//Use 'connection' event for authentication, not this server 'upgrade' event
server.on('upgrade', (request, socket, head) => {});

//routes
app.use("/api", apiRoute);


//webpages and static resources

//set public folder for getting website assets(CSS, Images, Javascript)
app.use("/js", express.static(JS_ROOT));
app.use("/static", express.static(STATIC_ROOT));

app.get("/favicon.ico", (req, res) => {
  res.sendFile("favicon.ico", {root: STATIC_ROOT});
});

app.get('*', (req, res) => {
  res.sendFile('index.html', {root: HTML_ROOT});
})
/*
app.get("/", (req, res) => {
  res.sendFile("account.html", {root: HTML_ROOT});
});

app.get("/home", (req, res) => {
  res.sendFile("home.html", {root: HTML_ROOT});
});


// 404 error handler
app.use((req, res, next) => {
  res.status(404).sendFile("404.html", {root: HTML_ROOT});
});

// 500 server error handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).sendFile("home.html", {root: HTML_ROOT});
}
app.use(errorHandler);
*/

//use port 3000 to have client use indexeddb for old service
//use port 3100 to have client use indexeddb for new service

server.listen(3100, () => {
  console.log("Server Started!");
})