# E2E2 (End-To-End Encrypted) Website

A instant-messaging web application where users can send encrypted messages to each other that cannot be read by the web server.

> Disclaimer: Do not use this project in any production service. 
> This project's only purpose is to serve as a educational tool on using
> the WebCrypto API and applying cryptographic primitives in a web application.
> There is no guarantee that this software can protect a user's encrypted
> messages.

## Current Objectives
1. Setup account creation and login
## Future Objectives
1. Figure out how users setup shared key in case of bad clients
  - Right now, a client can claim to have generated a shared key without proof, which currently prevents all group members from communicating on that chat until everyone in the chat leaves. 
  - This acts as a small scale denial-of-service attack and forces other users to create a new chat.
  - In addition, a client can claim to have accepted a shared key even if it was invalid. It prevents us from assuming that if every recipient of the shared key accepts it, that the key must be correct. If we do assume this and 2 users do this before everyone else joins a group chat, everyone else will be unable to speak in the chat.

  - This can be fixed by:
    - When a user first connects to the WebSocket Server, a unmodified client should send its encrypted shared key to all other clients connected.
    - If all of the recipients of the shared key are unable to import the shared key, wait until another client sends their generated shared key.
    - This repeats until at least 1 client accepts a shared key. However, the sender of that key is told that only 1 client can read their messages.
    - However, if another client generates a shared key and more clients accept the new shared key, then all users who join will receive this key and the users with the old shared key are asked to import the new shared key to join the conversation with everyone else.
    - If a client does not accept the most popular shared key, then the next most popular shared key is used.

  - This fixes the problem by allowing all members with unmodified clients to communicate with each other and prevents those with compromised or malicious clients from locking out communication between these unmodified clients.


## Project Structure
- **src/** contains all Typescript files.
  - **src/client/** contains all browser-side code kept in the website's /js route.
    - **src/client/shared/** is a special folder that contains code that can be used both server-side and client-side.
  - **src/server/** contains all server-side code.

- **client-assets/** contains all static website assets (HTML, CSS, Images)
  - **client-assets/public/** contains non-HTML assets and serves as the website's root folder.
  - **client-assets/html/** contains all HTML files used in website.

- **dist/** stores the transpiled Javascript from the Typescript inside the src/ folder.

## To Run Project
In order to build and run the project:
1. Install NodeJS and NPM (this was tested on Node 20 LTS and NPM 10.3)
2. Run `npm install` at root of project.
3. Run `npm run build` to build project.
4. Run `npm run start` to start web server on port 3000.

## Project Requirements
* This messaging service should allow users to communicate to each other via:
  - Text
  - Images
  - Files
* ALL messages are end-to-end encrypted, meaning the server should not be capable of decrypting messages.
* Users can form group chats
* Users can invite each other to certain group chats
* Group chats can be organized by topics or channels (simlar to Discord Servers/Channels or Element's Matrix Spaces/Rooms)
* If users are removed from a chat, all encryption keys are regenerated if needed
* Chats can be asyncronous (a user can send a message to an offline user and the offline user will receive the message once they connect to server).

- Accounts and Login
  - All users must register their device when first creating an account.
  - All cryptography keys used to log in must be persisted on browser.
  - Only one primary device per account.
    - Signal and Whatsapp use phone number, so the phone is the main device, though you can link other computers to your account via your phone.
    - (Optional) Consider adding option to link up to 2 other devices. Your main device must be used to link both.
  - Users can transfer accounts from one device to another if needed
  - If device is lost:
    - Have user request that they want to backup their device. The client generates a second keypair and sends the public key to the server. The private key is then stored as a file on the client, and the user is responsible for putting it in a safe spot (maybe allow encrypted via PBKDF2). When the user registers from another device, they have the option to recover their account using this file. If this succeeds, then the user gets access to their account, a new keypair is generated for that device for messaging, and the user loses their old messages. 
  - If another person steals your credentials and puts it in their browser:
    - The original owner should delete their account, preventing the malicous user from receiving or sending any more messages.

## Client Side
* Uses Persistant Storage (IndexedDB) to store encryption keys and received messages.
* Crypto Keys cannot be deleted, but messages can.

### Tools
- Front-end Framework
  * None. Using standard HTML/CSS/Javascript
- Encryption Library
  * Web Crypto API (native to all targeted browsers)
- Supported Browsers: 
  - Safari (desktop and mobile)
  - Chrome (desktop and mobile)
  - Firefox (desktop and mobile)
  - Edge (desktop and mobile)
  - Any other browser that supports Persistant Storage, WebCrypto API, and WebSockets.


### Encryption
**\*FOCUS MORE ON THIS\***

Methods for Encrypting Messages:
1. Shared Key
  - One of the clients in a group chat creates an AES key, encrypts it with each chat member's public key, and sends the encrypted key to each client.
  - This single key is used by each client to encrypt messages they send and decrypt messages they receive.
  - Will need a way to allow clients to talk even if shared key generated by one client is rejected by other clients.
2. Use 3-Party Diffe-Hellman Key Exchange.


## Server Side
The server serves 3 primary purposes:
1. Allow clients to create accounts and login
2. Distribute encrypted messages between multiple clients
3. Store the encrypted messages and files of its clients until every device owned by those clients receives the message.

### Tools
- Back-end Framework
  * NodeJS Runtime
  * ExpressJS to simplify setting up API routes (MIT)
  * WS NPM package to simplify handling WebSocket server. (MIT)
  * postgres NPM package for communicating with database (Unlicense)
  * jsonwebtoken NPM package for handling user session after login via JWT (MIT)
- Database
  * PostgreSQL 

### Login
- When creating an account, a keypair is generated and the server keeps the public key.
- When logging in, the server generates a long, random string, encrypts it via the user's public key, and sends it to the client. If the client can decrypt the message and send it in plaintext to the server, then the user is logged in.
- When receiving session cookie, ensure that cookie property HttpOnly is set to true to prevent Javascript on browser from accessing it.

## Examples Of Similar Projects
* Signal (simple messaging app with e2ee, has no web client)
  - End-to-End-Encrypted messages
  - Must use phone number and phone to create account.
  - Can link up to 5 computers (NOT PHONES) to same account, but unlinks after 30 days.
  - Linked devices do not sync conversation history since each device generates its own keypair.
  - Uses Signal Protocol
  - Centralized
  - No web client
* Element 
  - more complex messaging app 
  - allows the client to connect to multiple servers and spaces using Matrix protocol.
  - Users can self-host the page using Synapse or another server implementation of the Matrix protocol
  - End-to-end encryption is optional
  - Decentralized, meaning messages can be sent across multiple servers, even self-hosted ones.

* WhatsApp 
  - Very similar to Signal
    - Must use phone to register
    - Uses Signal Protocol
    - Asyncronous Messaging
  - Can link up to 4 devices (including phones) using primary phone temporarily
  - Message History does sync message history, but requires your phone to have the Whatsapp app open and is slow on web client. Primary phone has the greatest priority
  - Has Web Client
* Wire
 - Uses Proteus protocol, an implementation of Signal protocol
 - Allows up to 8 devices to be linked, but does not sync conversation history between devices since each device generates its own keypair
 - 1 temporary device can be used to login on a public computer to view and send new messages. This device deletes all messages locally on logout and has limited permissions.
 
* Discord 
  - users can talk in private chats or on public "servers"
  - Centralized Server
  - messages are not encrypted and are persistant
  - Asyncronous chats


## Other End-to-End-Encrypted Instant Messaging Protocols
* Signal
* OMEMO (extension of XMPP Protocol)
* OLM and MEGOLM (extension of Matrix Protocol)
* OpenPGP (not necessary a instant messaging protocol, but may be useful)


## Glossery (And Other Useful Words)
- Forward Secrecy (or Perfect Forward Secrecy)
  - a feature of key-agreement protocols that assures that the session keys generated during key-agreement cannot be compromised even if the long-term secrets used in the key-agreement are compromised.
  - This protects past messages from being decrypted if a attacker gets the long-term secrets.
  - Past Messages Safe, future messages compromised
  - TLS (aka modern HTTPS) achieves forward secrecy through Ephemreal Diffie-Hellman Algorithm

- Future Secrecy (Post-Compromise Secrecy (PCS) or Backward Secrecy)
  - Opposite of Forward Secrecy
  - Assures that even if long term secrets are compromised, the protocol can "self-heal" and continue to protect messages after the compromise. 
  - Future Messages Safe, past messages compromised
  - Double Ratchet Algorithm achieves this

- Authenticated Encryption
  - https://en.wikipedia.org/wiki/Authenticated_encryption

- Asyncronous Messaging
  - Users do not have to be connected to server to receive messages

- Server-Side Fanout
  - Server receives one encrypted message from a client, and then sends that message to all connected clients

- Client-Side Fanout
  - Client generates different ciphertext from a message for each connected client and sends each encrypted message to the server for each client.