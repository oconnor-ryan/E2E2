import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';

function clearFolder(dir) {
  let items = fs.readdirSync(dir);
  for(let item of items) {
    fs.rmSync(path.join(dir, item), {recursive: true});
  }
}

//remove contents of build folders
//clearFolder("./dist");

  
//transpile Typescript to Javascript for client and server
execSync("tsc");