# End-To-End-Encrypted(E2EE) Web Application

## Project Requirements
* This messaging service should allow users to communicate to each other via:
  - Text
  - Images
  - Files
* Users can form group chats
* Users can invite each other to certain group chats
* Group chats can be organized by topics or channels (simlar to Discord Servers/Channels or Element's Matrix Spaces/Rooms)
* Users can self-host the server for their own private use.


## Client Side
* This should be a separate project so that users who don't trust
the server they're connected to can clone the project via Git and build
the project themselves.
* Will be a Single Page Application since there is no need for complex SEO
and the UI will remain mostly the same thoughout the app.
* Attempt to request use of Persistant Storage (Local Storage, IndexedDB) to
store encryption keys. Otherwise, prompt for a password to generate the key
from a key derivation function.

### Tools
- Front-end Framework
  * React would be good because of personal experience with NextJS
  * Could write my own Javascript, but that may be more tedious.
- Encryption
  * Web Crypto API (native to all targeted browsers)
- Bundler / Minifier
  * Webpack 


### UI and UX
* The page should not have to reload to view new messages.


## Server Side
The server serves 3 primary purposes:
1. Allow clients to create accounts 
2. Distribute messages between multiple clients
3. Store the encrypted messages and files of its clients
  - Clients will not store messages because we want one user to access their messages through multiple devices.

### Tools
- Back-end Framework
  * NodeJS Runtime
  * ExpressJS to simplify setting up Web API routes
  * mysql2 or postgres NPM package for communicating with database
  * express-session NPM package for session handling
- Database
  * MariaDB or PostgreSQL

## Optional Features
* Audio and Video Calls (similar to Discord)
*

## Examples Of Similar Projects
* Signal (simple messaging app with e2ee, has no web client)
* Element (more complex messaging app, allowing the client to connect to multiple servers and spaces using Matrix protocol. Users can self-host the page using Synapse or another server implementation of the Matrix protocol)
* WhatsApp (similar to Signal, but has web client)
* Discord (users can talk in private chats or on public "servers", user's cannot self-host Discord and messages are not encrypted)
* Microsoft Teams (similar to Element, but no self-hosting and has options
to download extensions)
