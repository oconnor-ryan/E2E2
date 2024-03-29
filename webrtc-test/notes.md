STUN server:
https://datatracker.ietf.org/doc/html/rfc5389

A STUN server allows a client to get their remote IP address and port. 
This remote IP and port of Client 1 are then sent to my website's API server via WebSocket to the receiving client. The receiving client Client 2 then calls the STUN server for their remote IP and port and sends it to Client 1. Now that both of them know each others external IP addresses and port, they can now connect to each other and talk, unless one of the client's NAT or firewall blocks this activity.

TURN server:
https://datatracker.ietf.org/doc/html/rfc5766

A TURN server allows 2 peers to connect to each other even when their firewall or NAT prevent it. This is because the TURN server acts as a relay exposed to the public Internet.


Data Channel:
A network channel that allows peers to send arbitrary data bi-directionally.

## Encryption
https://webrtc-security.github.io/

For Data Channels, they are encrypted with Datagram Transport Security Layer (DTLS) by default and has about the same security as regular TLS.

For Media Streams (video, audio), they are encrypted using Secure Real Time Communication (SRTP) by default. This is used instead of DTLS because SRTP is lighter.

A SRTC-DTLS handshake is performed to create the needed encryption keys automatically.

As a result, neither the signaling server (main web server) or the TURN server can read messages. The signaling server only receives some metadata and the TURN server can only relay encrypted packets.



