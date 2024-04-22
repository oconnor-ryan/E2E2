import dns from 'dns';
import express from 'express';

import * as db from '../util/database-handler.js';

const router = express.Router();

//for federated servers only

//get domain name from IP address and port and verify that the domain is allowed on this server
router.use("/", (req, res, next) => {
  dns.lookupService(req.socket.remoteAddress!, req.socket.remotePort!, (err, hostname, service) => {
    if(err) {
      console.error(err);
    }
    //service is something like http, ssh, etc

    //Note that windows (and hopefully other OS) getnameinfo implementation will return
    //a hostname as an IP address if it cannot find the hostname of an IP address
    console.log("Requesting Server's Hostname:", hostname);
    res.locals.domain = hostname + ":" + req.socket.remotePort!;

    //if server has whitelist or blacklist, check that blacklist to find out if this
    //domain is allowed to access this server.

    next();
  });
});

router.get("/get_outgoing_messages_and_invites", (req, res, next) => {
  const domain = res.locals.domain
  
  let searchParams = new URL(req.url!, req.headers.host).searchParams;
  let lastReadUUID = searchParams.get('lastReadUUID') ?? undefined;

  //all domains store both hostname AND port

  Promise.all([db.getOutgoingInvites(domain), db.getOutgoingMessages(domain, lastReadUUID)])
  .then(result => {
    res.json({
      type: 'queued-invites-and-messages',
      invites: result[0],
      messages: result[1]
    })
  })
  .catch(e => {
    next(e);
  })
});

router.post('/sendinvite', (req, res, next) => {
  res.json({error: "NoImplementation"});
});

router.post('/sendmessage', (req, res, next) => {
  res.json({error: "NoImplementation"});
});


export default router;