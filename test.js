import {execSync, spawn} from "child_process";

//build project
execSync("npm run build");

//start NodeJS project
spawn("node", ["./dist/server/index.js"], {
  cwd: process.cwd(), //use same current working directory
  detached: false, //make sure that process is stuck to this one so that it closes
  stdio: "inherit" //inherit stdin, stdout, stderr so we can see output
});


