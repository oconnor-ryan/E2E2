//This is the only NodeJS script, which contains helper functions in order
//to help serve the static HTML/CSS/Javascript in the src/webroot folder
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

export * as JsonValidator from "./webroot/js/shared/JSON-Validator.js";

//get the root folder where all website assets are stored
export function getStaticFileRoot() {
  return import.meta.resolve("./webroot");
}

//export contents of build folder so that they can be bundled with another
//project
export function putDistFilesInDir(absDir: string) {
  let root = fileURLToPath(getStaticFileRoot());

  let items = fs.readdirSync(root);

  for(let item of items) {
    fs.cpSync(path.resolve(root, item), path.resolve(absDir, item), {recursive: true});
  }
}
