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
 * Recursively delete all files from a directory with a certain extension from the extArr parameter
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
      recursiveDeleteFilesWithExt(filePath, extArr, false);
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


function main() {
  
 // recursiveDeleteFilesWithExt("./dist", ['.js']);
 // clearFolder("./types");


  //transpile Typescript to Javascript for client and server
  execSync("tsc --build");
  
  console.log("Project successfully built!");
}

main();





