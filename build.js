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

function main() {
  let buildClient = false;
  let buildServer = false;
  
  if(!process.argv[2]) {
    buildClient = true;
    buildServer = true;
  }
  else if(process.argv[2] == "--client") {
    buildClient = true;
  } else if(process.argv[2] == "--server") {
    buildServer = true;
  } else {
    console.error(`Invalid command-line argument, only --client and --server are valid options!`);
    process.exitCode = -1;
    return;
  }
  
  if(buildClient) {
    //remove contents of build folders
    clearFolder("./dist/client");
  
    //transpile Typescript to Javascript for client and server
    execSync("tsc --project ./src/client/tsconfig.json");
  
    //copy website static assets to dist folder
    fs.cpSync("./public", "./dist/client", {recursive: true});
  }
  
  if(buildServer) {
    //remove contents of build folders
    clearFolder("./dist/server");
  
    //transpile Typescript to Javascript for client and server
    execSync("tsc --project ./src/server/tsconfig.json");
  }
  
  console.log("Project successfully built!");
}

main();





