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

*/

/**
 * 
 * @param {string} dir - the starting directory to search for files to delete
 * @param {string[]} extArr - the array of file extensions that will be deleted from directory
 * @param {boolean} isRoot - whether or not dir is the root folder being searched
 */
function recursiveDeleteFilesWithExt(dir, extArr, isRoot = true) {
  let items = fs.readdirSync(dir);
  let numDeleted = 0;
  for(let item of items) {
    let filePath = path.join(dir, item);
    //if filePath is a directory, recursively call this function
    if(fs.statSync(filePath).isDirectory()) {
      recursiveDeleteFilesWithExt(filePath, ext, false);
    } 
    //if the file contains an extension from the list of extensions, delete it
    else if(extArr.find((ext) => filePath.endsWith(ext))){
      fs.unlinkSync(filePath);
      numDeleted++;
    }
  }

  //if all items were deleted in this directory, delete the directory itself
  //unless the directory is the root directory that is being searched
  if(numDeleted == items.length && !isRoot) {
    fs.rmdirSync(dir);
  }
}

function clearFolder(dir) {
  let items = fs.readdirSync(dir);
  for(let item of items) {
    fs.rmSync(path.join(dir, item), {recursive: true});
  }
}

/**
 * 
 */
function clearClientFolder() {
  recursiveDeleteFilesWithExt("./dist/client", ['.js']);
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
    clearFolder(");
  
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





