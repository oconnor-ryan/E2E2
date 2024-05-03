# E2E2 (**E**nd-**To**-**E**nd **E**ncrypted) Private Messanger

A instant-messaging web application where users can send encrypted messages to each other that cannot be read by the web server.

> Disclaimer: Do not use this project in any production service. 
> This project's only purpose is to serve as a educational tool on using
> the WebCrypto API and applying cryptographic primitives in a web application.
> There is no guarantee that this software can protect a user's encrypted
> messages.

## Project Structure
- **src/** contains all Typescript files.
  - **src/client/** contains all browser-side code kept in the website's /js route.
    - **src/client/shared/** is a special folder that contains code that can be used both server-side and client-side.
  - **src/server/** contains all server-side code.

- **client-assets/** contains all static website assets (HTML, CSS, Images)
  - **client-assets/static-root/** contains non-HTML assets and are served via the /static route of the website. Note that all assets inserted here are public.
  - **client-assets/html/** contains all HTML files used in website.

- **dist/** stores the transpiled Javascript from the Typescript inside the src/ folder.

## To Run Project
To build the database:
1. Install PostgreSQL
2. Run the SQL file in database-schema/schema.sql that contains the SQL commands to initialize the database tables used for the project.

In order to build and run the project:
1. Install NodeJS and NPM (this was tested on Node 20 LTS and NPM 10.3)
2. Run `npm install` at root of project.
3. Add a .env file at the root of the project containing the following environment variables:
  - Environment Variables:
    - DB_HOST
      - The host that the database server is on.
    - DB_PORT
      - The port that the database server is binded to.
    - DB_NAME
      - The name of the database.
    - DB_USER
      - The PostgreSQL user who owns the database.
    - DB_PSWD
      - The password of the PostgreSQL user who owns the database.
    Here is an example format of the .env file:
    ```
    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=e2e2
    DB_USER=ryan
    DB_PSWD=ryan
    ```
4. Run `npm run build` to build project.
5. Run `npm run start` to start web server on port 3000.


## Features
- Users can create chat rooms and invite other users to join their chat rooms.
- Chat members can send and receive end-to-end-encrypted messages and files to each other.
- Offline chat members will be able to retrieve messages sent to them while they were gone.
- Users can engage in 1-to-1 VoIP video calls using a peer-to-peer connection using WebRTC.

## Dependencies Used:
While no external dependencies were used on the browser client, there is a small subset of browsers that do not support the dependencies I have used.
- Client-Side Dependencies
  - Web Cryptography API 
    - Used for handling encryption, key exchanges, and signing messages.
  - WebRTC 
    - Used for creating for 1-to-1 VoIP video calls by establishing a peer-to-peer connection with both clients.
  - AJAX 
    - Used in order to append Authorization headers to API calls and render new data without reloading the page.
  - WebSocket 
    - A bi-directional communication protocol that allows clients and servers to send and receive data for each other.
    - Used for sending and receiving messages without polling the API server.
  - IndexedDB
    - A NoSQL database available on most browsers that allow clients to store complex data types.
    - Used to store messages, private cryptography keys, and metadata for chat rooms on the browser.
  - LocalStorage
    - Used to store basic key-value pairs, such as the username and password of an account.
- Server-Side Dependencies
  - ExpressJS NPM Package
    - Used to provide a minimal framework for setting up API endpoints.
  - ws NPM Package
    - Used to more easily setup a WebSocket Server that can manage all connected WebSocket clients
  - postgres NPM Package
    - Used to allow the NodeJS API server to connect to a PostgreSQL database.
  - multer NPM Package
    - Used to parse HTTP requests with Content-Type 'form-data' and save any files uploaded from clients to a directory on the server.
  - dotenv NPM Package
    - Used to allow environment variables to be stored in a file that can be loaded into the NodeJS process.
- Developer Dependencies
  - Typescript
    - A superset of Javascript that allows developers to use static typing. All Typescript is transpiled into Javascript.

## Authentication for API Endpoints
All endpoints in the API, with the exception of the /api/create-account endpoint, require a user to provide a account-specific credential to use. While creating an account, the browser client will generate a random 32-byte password that is Base64-Encoded. When making an request to an endpoint that requires authentication, the browser client will automatically append an Authorization header to every HTTP request with the following format:

Authorization: Basic BASE64_ENCODE(`<username>`:`<password>`)

The username and password are joined together via a colon (:) and Base64-Encoded. 


## API Endpoints

### POST /api/create-account

This is used to create an account using the provided username, password, and public keys used for X3DH key exchange.

### POST /api/searchusers

This will return a list of usernames that contain the string provided by the authenticated user. This is used in order to search for users to invite to a chat room.

### GET /api/getuserkeys

This retrieves the public keys of a specific user. These keys allow a authenticated user to perform a X3DH key exchange, which allows them to send an encrypted message to that user.

### Endpoints For Chat Rooms
#### POST /api/chat/createchat

This allows an authenticated user to create a chat room. This endpoint returns the ID of the chat room.

#### POST /api/chat/getchats

This retrieves the list of chat rooms that a authenticated user is in.

#### POST /api/chat/getinvites

This retrieves the list of invitations to chat rooms that are addressed to an authenticated user.

#### POST /api/chat/acceptinvite

After retriving a invitation, an authenticated user can call this endpoint to accept an invitation to join a chat room. Once a successful response is received from this endpoint, the new chat member will generate a new chat room encryption key and perform an X3DH key exchange with every member of the chat room. This step must be performed since the application does not allow newly-joined chat members to read previous messages. 


#### POST /api/chat/invite

This sends an invitation to a specific user to join a chat room owned by an authenticated user.


#### POST /api/chat/getchatinfo

This returns information about each member of the chat room, such as their username and whether or not they are the owner of the chat room.

#### POST /api/chat/chatmessages

This returns the list of all message in a chat room sent after a specific message. For example, if a chat member is offline and misses 4 messages, when they go back online, they specify the ID of the last-received message in the API call, and the server will only return the 4 messages that we sent after the ID of the last-received message. 

#### POST /api/chat/getuserkeysfromchat

This is similar to the /api/getuserkeys endpoint, except that it returns a list of public keys from each chat member in a chat room.

#### POST /api/chat/sendkeyexchangetochat

This is used either when a new chat member joins a chat room or when a chat member leaves a chat room. When performing a key exchange, a chat member must perform it with each chat member, generate a encrypted payload containing the new chat room encryption key, bundle it into a single HTTP request, and call this endpoint. This endpoint stores the public keys and encrypted payloads for each chat member.

#### POST /api/chat/getkeyexchangeforchat

This endpoint is used to retrieve the list of key exchanges that have been performed. In order to read newer messages, the chat member must call this endpoint to get the list of key exchanges addressed to them, perform the X3DH key exchange to derive a shared secret, decrypt an encrypted payload to get the new chat room encryption key, and decrypt the newer messages.

#### GET /api/chat/getfile

This endpoint retrieves an encrypted file uploaded to the server.

#### POST /api/chat/uploadfile

This endpoint allows users to upload an encrypted file to the server.



## WebSocket Messaging
WebSockets are used in order to send messages as well as receive messages from currently online users. All messages sent from a client are encrypted binary payloads, preventing the server from being able to read messages within a chat room.

### WebSocket Connection
There is no persistant WebSocket connection used. Instead, when a user navigates to a specific page, the client uses the parameters stored in the query string of the URL in order to help fill out the parameters used for the WebSocket connection. Here is the URL used to start a WebSocket connection:

`wss://<hostname>?chatId=<chatId>&userId=<username>&signatureBase64URL=<signature>&keyExchangeId=<keyExchangeId>`

* `<hostname>` is the domain of the website the server is hosting.
* `<chatId>` is the ID of the chat room, ususally provided within a query string in the URL of the user's current page.
* `<username>` is the username of the current user.
* `<signatureBase64URL>` is a Base64URL-Encoded signature of the username, signed by the user's ECDSA identity key. This is used for authentication.
* `<keyExchangeId>` is the ID of the last X3DH key exchange performed by the user. This linked to each message sent by the user so that offline users can retrieve the correct key exchange when decrypting messaging once they go back online.

Note that the WebSocket connection is closed when users leave the chat room page. The WebSocket only opens when the user is on the webpage for a specific chat room. This means that user are considered offline within a chat room if they are not on the exact webpage that is for their specific chat room. This prevents users from receiving notifications if they are on a different page and forces them to call the /api/chat/chatmessages endpoint each time they visit the webpage in order to view new messages.

### WebSocket Protocol 

#### Server-Side Protocol

Because the server cannot read the contents of a encrypted message, they mostly just relay encrypted payloads from client to client. However, for each message, they do generate a 36-byte UUID used for clients to store their last-read message ID. This UUID is stored along with the encrypted payload on the server's PostgreSQL database in an asyncronous call. This UUID is also sent back to the original sender of the encrypted payload so that the sender can record their last-received message's ID. The JSON used to send this UUID to the original sender looks like this:
{
  "type": "messageConfirm",
  "uuid": `<uuid>`
}
The `<uuid>` is the UUID generated by the server for the sent message.
If any of the recipients of the message are online, the server will append the UUID directly to the end of the encrypted binary payload so that the recipients can record their last-received message's ID. 

#### Client-Side Protocol

##### Encrypting and Decrypting Messages
When clients format messages, they first format it as a JSON value, then they encrypt it with the chat room's encryption key before sending it to the server. The client can receive this message in 2 ways: 
1. WebSocket Message 
2. Through the /api/chat/chatmessages endpoint. 

If receiving a message from /api/chat/chatmessages, the returned response looks like so:

{
  id: number,
  data_enc_base64: string,
  chat_id: number,
  key_exchange_id: number,
  message_uuid: string
}

The `data_enc_base64` property contains the encrypted payload, the `message_uuid` is the UUID of the message generated by the server, and `key_exchange_id` is the ID of the key exchange that was last performed when encrypting this message. The receiver of the message must call the /api/chat/getkeyexchangeforchat endpoint to get the list of key exchanges performed. Using the `key_exchange_id`, the receiver will derive the chat room encryption key from the appropriate key exchange and decrypt the message from the `data_enc_base64` property.

If the message was received from a WebSocket connection, the user will only receive the encrypted payload along with a UUID appended to it. The UUID is cut off from the encrypted payload and the payload is decrypted using the current chat room encryption key stored in IndexedDB.

##### Message Types
After decrypting the payload, each message can fall under two types: 

1. 'message', which is a basic text message
2. 'file', which is a text message with metadata for retrieving an encrypted file from the server.

The decrypted payload of a message with type 'message' looks like this:

{
  "type": "message",
  "message": `<string>`, 
  "senderId": `<username>`,
}

A message of type 'message' is very simple, it contains the sender's username as well as a text message that is stored on the browser.

The decrypted payload of a message with type 'file' looks like this:

{
  "type": "file",
  "message": `<string>`, 
  "senderId": `<username>`,
  "fileuuid": `<string>`,
  "filename": `<string>`,
  "filesig": `<string>`
}

This message contains 3 more properties:
1. "fileuuid" is the UUID of the file that the sender of the message uploaded to the server.
2. "filename" is the original filename of the sender's file before they uploaded the encrypted file to the server.
3. "filesig" is the signature of the encrypted file content, signed by the sender's identity key.

In order to retrieve the file, the client calls the /api/chat/getfile endpoint using the "fileuuid" property along with the ID of the chat room that the user is currently in. Then, they use the chat room encryption key to decrypt the file and save it in their Downloads folder on their computer.



## How Messages Are Encrypted
Each member of a chat room shares a single AES-GCM key used to encrypt/decrypt messages. This chat room encryption key is generated by one of the chat members and is sent to each chat member using the X3DH key exchange.

The following steps are performed in order to send an encrypted message.
1. When first joining a chat room, the new chat member must generate a AES-GCM encryption key, called the chat room encryption key, that all chat members will use for encrypting and decrypting messages.
2. They then perform an X3DH key exchange with each chat member and derive a shared secret from this exchange.
3. This shared secret is used as the key material of a AES-GCM key.
4. The shared secret key is used to encrypt the chat room's encryption key and is sent to each chat member by using the /api/chat/sendkeyexchangetochat endpoint.
5. At this point, the chat member who sent the key exchanges can now send messages.
6. When the other chat members go on the chat room, they retrieve the list of new key exchanges that have been performed, deriving the same shared secret that the new chat member derived and use that shared secret to decrypt the chat room's new encryption key. 
7. Now that they have the new chat encryption key, they can read the new chat members messages and send out their own messages to the rest of the chat room.

### X3DH Key Exchange
The link to the documentation for this algorithm is:
https://signal.org/docs/specifications/x3dh/

In order to allow asyncronous messages to be sent, I decided to implement the Extended Triple Diffie-Hellman (X3DH) key exchange algorithm from the Signal Protocol. This algorithm was developed by a software development group known as Open Whisper Systems, who later developed the Signal Messanger application. 

This algorithm only works with 2 users, meaning that each chat member must perform a X3DH key exchange for every chat member in a chat room.

I had to make a few modifications to the original X3DH exchange:
1. The Web Cryptography API has no support for the X25519 or X448 elliptic curves for cryptography keys that the original X3DH protocol recommends us to use. Thus, I replaced all signing keys with the Elliptic Curve Digital Signature Algorithm (ECDSA) using a P-512 elliptic curve and all Diffie-Hellman keys with the Elliptic Curve Diffie-Hellman (ECDH) algorithm using a P-512 elliptic curve.

2. In the Web Cryptography API, cryptography keys each have a specific type and cannot perform actions that their key type was not intended to do. For example, you cannot perform an Elliptic Curve Diffie-Hellman (ECDH) function on cryptography keys that are not explicitly marked with the type "ECDH". In the original protocol, each user's identity key pair was used both as a signing key and as the input of the ECDH function. Because the Web Cryptography API prevents this action, I created 2 identity key pairs, one is a ECDSA key pair used for signatures and one is a ECDH key used for the Diffie-Hellman exchanges used in the X3DH key exchange.

3. The original X3DH key exchange recommends the use a set of one-time prekeys that are used to improve forward secrecy. Since a one-time prekey can only be used once, each X3DH key exchange performed will change the one-time prekey, making it more difficult for an attacker to derive the shared secret outputted by the key exchange. I decided to exclude these one-time prekeys due to the extra complexity of managing each user's one-time keys. Also, the original X3DH protocol states that if no one-time prekeys are provided, it will still perform the key exchange without these keys anyways.

## VoIP Video Calls
Users can perform one-on-one video calls with each other using the WebRTC API available on most browsers. By establishing a peer-to-peer connection, the server has no access to the data sent during a video call, data that is end-to-end encrypted by default.

### Setup Before Starting A Call
To perform a call, we will allow both users to establish a peer-to-peer connection so that the server does not have to relay video and audio media between both users. However, both users do not know each other's IP addresses, codec parameters, and other information needed to establish a connection and transmit data. This is where a signaling server is needed. 

Signaling is the process in which 2 peers exchange data used to initiate a peer-to-peer connection by using a intermediary server that both peers are already connected to. In this case, this server's WebSocket server acts as the intermediary between two peers. 

In order to start signaling, both peers must use the following URL to connect to the WebSocket server:

wss://`<host>`?enc_type=call&userId=`<username>`&authtoken=`<password>`

* `<host>` is the domain name of the server hosting the website.
* `<username>` is your username.
* `<password>` is your URL-encoded password.

Once both peers have established a WebSocket connection, they will be able to view the list of online users who are connected to call room. From here, a user can select who they want to call.


### Starting A Call
Once a user chooses who they want to call, they must make an offer by sending a Session Description Protocol (SDP) string to the callee using the WebSocket connection. Information about SDP can be found here:

https://developer.mozilla.org/en-US/docs/Glossary/SDP

Once the callee receives this SDP, they will provide an answer using their own SDP string.
After this, both users will send a list of Interactivity Conneectivity Establishment (ICE) candidates, which are essentially a set of potential IP addresses, ports, and protocols (TCP or UDP) that each peer can use to establish a connection. More information about ICE can be found here:

https://developer.mozilla.org/en-US/docs/Glossary/ICE

After both users pick the lowest latency ICE candidate, they can establish a peer-to-peer connection and begin sharing video and audio data.

#### Perfect Negotiation
There is a race condition that can occur during the signaling process where if both users try to send an offer at the same time, each peer may get stuck in a infinite loop sending SDP strings and ICE messages to each other. To prevent this, I implemented the Perfect Negotiation pattern described in this link. 

https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation

Basically, when a client sends their SDP string, they send it in the following JSON format:
{
  "type": 'sdp',
  "ownerId": `<sender username>`,
  "otherId": `<receiver username>`,
  "sdp": `<sdp>`
}

Once this message reaches the server, the server appends one extra property and sends it to the receiving client: 

{
  "type": 'sdp',
  "ownerId": `<sender username>`,
  "otherId": `<receiver username>`,
  "sdp": `<sdp>`,
  "bePolite": `<boolean>`
}

This "bePolite" property is set to true or false depending on whichever user in the call connected to the WebSocket server first. This "bePolite" property is used to mark one client as "polite" and the other as "impolite". 

A "polite" client will rollback any current attempt to establish a peer-to-peer connection if it receives a offer from the other client. It will then proceed to answer the other client.

A "impolite" client will ignore all incoming offers if it has already sent an offer. It will only respond to an answer.

By implementing this pattern, even if both clients start a call at the same time, the "polite" client will rollback their offer and respond to the "impolite" client, preventing the race condition I described before.

## Found Vulnerabilities
I did not have the time to fix some issues that I found while developing this application, so I am listing some of the biggest vulnerabilities here. 

### Server Can Decrypt Messages
The biggest issue is that there is a bug where a server can decrypt all future messages sent within a chat room. Here are the steps to do this:

1. An attacker creates an account using a browser client.
2. The attacker gains control of the server hosting the website through some method outside the scope of this project.
3. Because the server stores the list of chat members unencrypted in a PostgreSQL database, the attacker can create an invitation from the owner of any chat room and send it to their own malicious client.
4. The attacker's client can choose to accept the invitation, which causes the malicious client to generate the chat room's new encryption key and perform a key exchange with each member of the chat room.
5. If other chat members do not notice that a new user has joined their group, they may start sending messages that the malicious client can now decrypt.
6. Now the attacker can decrypt all future messages sent in this chat room.

While I have tried to implement a solution, I was not able to finish it. However, the code I wrote to solve this problem can be found on the 'v2' Git branch of this project.


### Server Can Change Javascript Files
Because this is a web application, any malicious server can modify the Javascript it serves to relay decrypted messages back to itself, delete cryptography keys, add different cryptography keys, and more. There is not anything that this project can do to prevent this, as this is an inherent flaw with any website.

A partial solution I implemented is to allow the API server to work with non-browser clients by making the API server output only JSON and binary data (for files). These data types can easily be parsed by non-browser clients, which do not need the Javascript sent by browsers in order to work.


### Potential Cross-Site Scripting Attacks (XSS)
While I have taken precautions to prevent XSS attacks, such as preventing user-generated text from being parsed as HTML by using the 'textContent' property of HTMLElement instead of 'innerHTML', I did not use any sanitization libraries that would prevent me from accidentally adding a XSS vulnerability in the future. While I have not found any XSS vulnerabilities, there is no guarantee that there isn't one hidden.


## V2 Git Branch
The 'v2' branch I created as an attempt to rewrite the messaging protocol to fix the vulnerability where a attacker with control of the server can decrypt messages. It includes the following features:
- It is a Single Page Application that uses client-side routing and rendering to display webpages instead of relying on the server.
- By making this a Single Page Application, the client never needs to refresh the page and can maintain a persistant WebSocket connection that displays notifications and saves messages automatically no matter what page they're on. 
- It fixes the vulnerability found by only allowing the client to store the list of chat members. The clients are now responsible for keeping track of who is in the chat room.
- The chat room encryption key is replaced with a secret key generated by X3DH between every pair of users that share at least one chat room. With this, the server does not know what messages belong to what chat room, it only knows that one person sent a message to another person.
- All messages are now signed using the sender's identity key, further preventing other users from impersonating each other

There are many features from the main branch that I did not have the time to port into the v2 branch, however, such as:
- File Uploads
- Video Calls

This is why I kept these new changes on a separate branch.

## Future Goals
1. Add the Double Ratchet Algorithm from the Signal Protocol so that the X3DH shared secret key generated between 2 users can be altered after each message sent, improving forward secrecy. 
2. Add a backup feature that allows users to export all of their data stored in IndexedDB into a file encrypted by a AES key generated by the PBKDF2 algorithm, which allows a user to generate an encryption key using a password. This data can then be imported into another browser so that the user can keep their message history and chat rooms.
3. Implement a federated protocol that allows users from one E2E2 server instance to communicate with users from another E2E2 server instance. This would act similarly to email and federated social media networks like Mastadon, where you can create an account from one provider and be able to send and receive messages from clients from another provider.

## Examples Of Similar Projects
* [Signal](https://signal.org)
  - End-to-End-Encrypted messages
  - Client-Side Fanout of messages
  - Must use phone number and phone to create account.
  - Can link up to 5 computers (NOT PHONES) to same account, but unlinks after 30 days.
  - Linked devices do not sync conversation history since each device generates its own keypair.
  - Uses Signal Protocol
  - Centralized
  - No web client

* [Element](https://element.io/) 
  - allows the client to connect to multiple servers and spaces using Matrix protocol.
  - Users can self-host the page using Synapse or another server implementation of the Matrix protocol
  - End-to-end encryption is optional
  - Decentralized, meaning messages can be sent across multiple servers, even self-hosted ones.

* [WhatsApp](https://www.whatsapp.com/) 
  - Very similar to Signal
    - Must use phone to register
    - Uses Signal Protocol
    - Asyncronous Messaging
  - Can link up to 4 devices (including phones) using primary phone temporarily
  - Message History does sync message history, but requires your phone to have the Whatsapp app open and is slow on web client. Primary phone has the greatest priority
  - Has Web Client
* [Wire](https://wire.com/en)
 - Uses Proteus protocol, an implementation of Signal protocol
 - Allows up to 8 devices to be linked, but does not sync conversation history between devices since each device generates its own keypair
 - 1 temporary device can be used to login on a public computer to view and send new messages. This device deletes all messages locally on logout and has limited permissions.
 
* [Discord](https://discord.com/) 
  - users can talk in private chats or on public "servers"
  - Centralized Server
  - messages are not encrypted and are persistant
  - Asyncronous chats


## Other End-to-End-Encrypted Instant Messaging Protocols
* [Signal](https://signal.org/docs/)
* [OMEMO](https://xmpp.org/extensions/xep-0384.html)
* [OLM and MEGOLM](https://matrix.org/docs/matrix-concepts/end-to-end-encryption/)
* [OpenPGP](https://datatracker.ietf.org/doc/html/rfc4880) 
  * not necessarily a instant messaging protocol, but may be useful
* [MLS](https://datatracker.ietf.org/doc/html/rfc9420)


## Glossery 
- Forward Secrecy (or Perfect Forward Secrecy)
  - a feature of key-agreement protocols that assures that the session keys generated during key-agreement cannot be compromised even if the long-term secrets used in the key-agreement are compromised.
  - This protects past messages from being decrypted if a attacker gets the long-term secrets, but not future messages

- Future Secrecy (Post-Compromise Secrecy (PCS) or Backward Secrecy)
  - Opposite of Forward Secrecy
  - Assures that even if long term secrets are compromised, the protocol can "self-heal" and continue to protect messages after the compromise once a user regains control.

- X3DH (Extended Triple-Diffie-Hellman) Algorithm
  - A one-to-one key exchange protocol that allows two users to derive a shared secret.
  - This is an extenstion of the Triple-Diffie-Hellman key exchange, which is an extenstion of the Diffie-Hellman key exchange.
  - https://signal.org/docs/specifications/x3dh/

- Asyncronous Messaging
  - Users are able to retrieve messages sent while they were offline once they reconnect to the server that the messages were sent to.

- Server-Side Fanout
  - Server receives one encrypted message from a client, and then sends that message to all connected clients

- Client-Side Fanout
  - Client generates different ciphertext from a message for each connected client and sends each encrypted message to the server for each client.