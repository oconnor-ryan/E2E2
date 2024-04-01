STUN server:
https://datatracker.ietf.org/doc/html/rfc5389

A STUN server allows a client to get their remote IP address and port. 
This remote IP and port of Client 1 are then sent to my website's API server via WebSocket to the receiving client. The receiving client Client 2 then calls the STUN server for their remote IP and port and sends it to Client 1. Now that both of them know each others external IP addresses and port, they can now connect to each other and talk, unless one of the client's NAT or firewall blocks this activity.

TURN server:
https://datatracker.ietf.org/doc/html/rfc5766

A TURN server allows 2 peers to connect to each other even when their firewall or NAT prevent it. This is because the TURN server acts as a relay exposed to the public Internet. TURN is an extension of STUN, so it can do anything a STUN server can do, with the addition of being a relay between two peers hiding behind NAT or firewall as a last-resort way to connect them. Note that SRTC generates encryption keys on the clients only, so the TURN server is unable to decrypt the messages it relays.


Data Channel:
A network channel that allows peers to send arbitrary data bi-directionally.

## RTCPeerConnection
Note that a network connection is REQUIRED for a RTCPeerConnection to be constructed, even if no STUN-TURN server is being used and all clients are on localhost.

## E2E Encryption
https://webrtc-security.github.io/

For Data Channels, they are encrypted with Datagram Transport Security Layer (DTLS) by default and has about the same security as regular TLS.

For Media Streams (video, audio), they are encrypted using Secure Real Time Communication (SRTP) by default. This is used instead of DTLS because SRTP is lighter.

A SRTC-DTLS handshake is performed to create the needed encryption keys automatically.

As a result, neither the signaling server (main web server) or the TURN server can read messages. The signaling server only receives some metadata and the TURN server can only relay encrypted packets.


HOWEVER:

https://webrtchacks.com/true-end-to-end-encryption-with-webrtc-insertable-streams/

https://bloggeek.me/webrtc-media-server/#h-the-role-of-a-webrtc-media-server


For large group calls (10 or more people), there will likely be major performance issues since each client has to send their media stream to everyone on the call. 

The use of a Media Stream Server (SFU for example) can be used, where each client in a call sets up a RTCPeerConnection to the Media Server. This is NOT A TURN Server because it becomes a peer in the call rather than being a relay between peers. However, because each client only connects to the Media Server, they perform the SRTC-DTLS handshake with the Media Server, allowing the Media Server to decrypt messages.

https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_Encoded_Transforms#test_if_encoded_transforms_are_supported

To solve this issue, you can use Insertable Streams and Encoded Transforms in order to manually encrypt the bytes in a media stream before it is encrypted by SRTC. Thus, when the SRTC-encrypted data is sent to the Media Server, it can only decrypt the SRTC layer of encryption for the data and cannot read the second layer of custom-encrypted data. 

This is very similar to my chatrooms, where all messages are encrypted with both a AES-GCM key only known by the clients and a crypto key from the TLS handshake. The web server can only decrypt the TLS layer but not the custom crypto key layer.

This feature is only supported in Firefox and Safari (according to Mozilla), however, it is confirmed to work on Chromium-based browsers.




