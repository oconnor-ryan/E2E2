import express from "express";

import path from "path";
import {fileURLToPath} from "url";

//since __dirname is not supported in EJS modules, 
//set it yourself with the following code.
//This path is relative to the directory where the server index.js is at.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

//the website's root folder
const ROOT = path.join(__dirname, "../client"); 


const app = express();

//set public folder for getting website assets(HTML, CSS, Images, Javascript)
app.use(express.static(ROOT));

//convert request body to JSON automatically
app.use(express.json());

//parse strings that are encoded in URL (example: "%20%" is replaced with " ")
app.use(express.urlencoded({extended: true}));

app.use("/", (req, res, next) => {
  console.log("Request Made");
  next();
});

app.get("/", (req, res) => {
  res.sendFile("index.html", {root: ROOT});
})



app.listen(3000, () => {
  console.log("Server Started!");
})