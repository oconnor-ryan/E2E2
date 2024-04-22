import https from 'https';

export async function getQueuedMessagesAndInvitesFrom(remoteServer: string) {
  let lastColonIndex = remoteServer.lastIndexOf(":")
  let port = remoteServer.substring(lastColonIndex+1);

  return new Promise((resolve, reject) => {
    let data: Buffer[] = [];
    https.request({
      hostname: remoteServer.substring(0, lastColonIndex),
      port: port,
      path: "/api/federated/get_outgoing_messages_and_invites",
      method: "GET"
    }, (res) => {
      res.on('data', (chunk) => {
        data.push(chunk);
      });

      res.on('error', (err) => {
        reject(err);
      })

      res.on('end', () => {
        if(!res.complete) {
          return reject(new Error("Failed to finish parsing HTTP response!"))
        }
        const json = JSON.parse(Buffer.concat(data).toString('utf-8'));

        //parse json here

        resolve(json);
      })

    })
  });
  
}