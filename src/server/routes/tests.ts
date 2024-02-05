import express from 'express';

//local files
import { getChatRoomsWithTheseMembers, getChatRoomsWithTheseMembersOnly} from '../util/database.js';

const router = express.Router();

//test routes
router.post("/testgetchatonlymembers", async (req, res) => {
  let users = ['bob', 'alice'];

  console.log("HERE");
  let chats1 = await getChatRoomsWithTheseMembers(...users);

  console.log(chats1);


  console.log("HERE2");
  let chats = await getChatRoomsWithTheseMembersOnly(...users);

  console.log(chats);
  res.json({error: null});

});



export default router;