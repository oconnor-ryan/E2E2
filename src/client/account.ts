import * as ecdsa from "./encryption/ECDSA.js";
import * as ecdh from "./encryption/ECDH.js";

import * as storage from './util/StorageHandler.js';

const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
const messageElement = document.getElementById('result-message') as HTMLParagraphElement;

async function main() {
  let storageHandler = await storage.getDatabase();

  accountForm.onsubmit = async (e) => {
    e.preventDefault(); //dont allow post request to go through
  
    //@ts-ignore
    let username: string = accountForm.elements["username"].value;
  
    console.log(username);
  
    let idKeyPair = await ecdsa.createKeyPair();
    let exportedIdPubKey = await ecdsa.exportPublicKey(idKeyPair.publicKey);
  
    let exchangeKeyPair = await ecdh.createKeyPair();
    let exportedExchangePubKey = await ecdh.exportPublicKey(exchangeKeyPair.publicKey);

    let preKey = await ecdh.createKeyPair();
    let exportedPrePubKey = await ecdh.exportPublicKey(preKey.publicKey);

    let exchangeKeySignature = await ecdsa.sign(exportedExchangePubKey, idKeyPair.privateKey);
    let preKeySignature = await ecdsa.sign(exportedPrePubKey, idKeyPair.privateKey);

  
    let response = await fetch(
      "/api/create-account", 
      {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          id_pubkey_base64: exportedIdPubKey,
          exchange_pubkey_base64: exportedExchangePubKey,
          exchange_pubkey_sig_base64: exchangeKeySignature,
          exchange_prekey_pubkey_base64: exportedPrePubKey,
          exchange_prekey_pubkey_sig_base64: preKeySignature
        })
      }
    );
  
    let jsonRes = await response.json();
  
    if(!jsonRes.error) {
      storageHandler.addKey({keyType: "id_keypair", key: idKeyPair});
      storageHandler.addKey({keyType: "exchange_keypair", key: exchangeKeyPair});
      storageHandler.addKey({keyType: "exchange_prekey_keypair", key: idKeyPair});

      storageHandler.updateUsername(username);
  
    }
  
    messageElement.innerHTML = `Create Account Result: ${JSON.stringify(jsonRes)}`;
  }

}

main();