//This is the only NodeJS script, which contains helper functions in order
//to help serve the static HTML/CSS/Javascript in the src/webroot folder


//get the root folder where all website assets are stored
export function getStaticFileRoot() {
  return import.meta.resolve("./webroot");
}

getStaticFileRoot();