import fs from 'fs';
import path from 'path';
import {execSync} from "child_process";

/* Eqivalent to following bash code
#!/bin/bash
set -e  # kill script if any command fails with non-zero exit code

# clean dist folder
rm -r ./dist/client/*
rm -r ./dist/server/*

# transpile typescript from client and server into 2 bundled Javascript files
tsc --project ./src/server/tsconfig.json 
tsc --project ./src/client/tsconfig.json

# copy all website assets into dist client folder
cp -r ./public/* ./dist/client
*/

function clearFolder(dir) {
  let items = fs.readdirSync(dir);
  for(let item of items) {
    fs.rmSync(path.join(dir, item), {recursive: true});
  }
}

//remove contents of build folders
clearFolder("./dist/server");
clearFolder("./dist/client");

//transpile Typescript to Javascript for client and server
execSync("tsc --project ./src/server/tsconfig.json");
execSync("tsc --project ./src/client/tsconfig.json");

//copy website static assets to dist folder
fs.cpSync("./public", "./dist/client", {recursive: true});

console.log("Project successfully built!");





