import { getDatabase } from "../storage/StorageHandler.js";
import { ROUTER } from "./router/router.js";

//wait for database to load first time before routing client-side
getDatabase()
  .then(db => {
    ROUTER.render(window.location.pathname);
  })
  .catch(e => {
    console.error(e);
  });