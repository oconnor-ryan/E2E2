import { SignalingServerMessageHandler } from "./SignalingServerMessageHandler.js";

//Two great links for explaining how peer-to-peer connections are established in WebRTC
//as well as how the "Perfect Negotiation" pattern is useful
//https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
//https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation




function logSelectedIceCandidate(peerConnection: RTCPeerConnection) {
  peerConnection.getStats().then((stats) => {
    let localCandId = "";
    let remoteCandId = "";

    stats.forEach(stat => {
      console.log(stat);
      if(stat.type === 'candidate-pair') {
        //@ts-ignore
        localCandId = stat.localCandidateId;
        remoteCandId = stat.remoteCandidateId;
      }
    });

    console.log(localCandId);
    console.log(remoteCandId);

    stats.forEach(stat => {
      if(stat.id === localCandId || stat.id === remoteCandId) {
        console.log(stat);
      }
    });

  });
}
/**
 * Establish a peer-to-peer WebRTC connection between two users using the 
 * "Perfect Negotiation" pattern. Because of this pattern, this function can be
 * called regardless of whether the client is calling someone or receiving a call.
 * @param signalServer - the intermediary server needed to help establish a direct connection between peers
 * @param remoteVideo - the video element to display video data from a remote peer
 * @param mediaTracks - this user's video and audio tracks from their webcam and microphone
 */
export function negotiateP2PConnection(signalServer: SignalingServerMessageHandler, remoteVideo: HTMLVideoElement, mediaStream: MediaStream) {
  //TODO: Use local STUN/TURN server since there are very few public TURN servers
  //PUBLIC STUN Servers:
  //https://gist.github.com/zziuni/3741933

  //Network bug???
  // Chromium-based browsers ON SCHOOL WIFI require a STUN server to establish a P2P
  // connection, even though both clients are on the same local network.
  // This does not occur on home network and does not occur on Safari/Firefox
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun3.l.google.com:19302'
      }
    ]
  });


  let makingOffer = false; //since creating an offer is asyncronous, use this to check whether an offer is currently being made

  let ignoreOffer = false; //track whether or not the last offer processed was ignored

  //impolite clients will always ignore offers on a offer collision, while polite clients will always accept offers incoming offers regardless of if there is a offer collision
  let isPolite = true; //value for isPolite is arbitrary; just ensure that one client is polite while the other is impolite

  //add media tracks from local user's webcam/mic to peer connection
  //so they can be sent to the remote peer
  try {
    let tracks = mediaStream.getTracks();
    for(const track of tracks) {
      peerConnection.addTrack(track, mediaStream);
    }
  } catch(e) {
    console.error(e);
  }

  

  //add event listeners for peerConnection

  peerConnection.onnegotiationneeded = async (e) => {
    //make an initial offer to connect to a remote client
    try {
      makingOffer = true;
      await peerConnection.setLocalDescription(await peerConnection.createOffer());
      signalServer.sendSessionDescription(peerConnection.localDescription!);
    } catch(e) {
      console.error(e);
    } finally {
      makingOffer = false;
    }
  };

  peerConnection.onicecandidate = (e) => {
    if(!e.candidate) {
      return;
    }
    //when a new ICE candidate was retrieved from client or STUN/TURN server, send it to the remote client
    signalServer.sendNewIceCandidate(e.candidate);
  };

  peerConnection.oniceconnectionstatechange = (e) => {
    console.log("ICE CONNECTION STATE", peerConnection.iceConnectionState);

    
    //if something went wrong when retrieving ICE candidates,
    //try retrieving ICE candidates again
    switch(peerConnection.iceConnectionState) {
      //failed to find suitable ice candidate pair, try restarting ICE to 
      //fix this issue
      case 'failed':
        console.log("RESTARTING ICE CONNECTION");
        peerConnection.restartIce();
        break;
      //when a connection is established, though ice candidate pairs may continue to
      //be gathered and checked to see if there is a better connection
      case 'connected':
        //logIceConnection(peerConnection);
        logSelectedIceCandidate(peerConnection);
        break;

      //the best possible ICE candidate pair has been selected
      //and a connection has been established
      case 'completed': 
        break;

      //when a connection disconnects (due to bad network, remote client closes tab without closing peer connection, etc).
      //note that on a bad network, a connection can be reestablished automatically
      //and go back to the 'connected' state
      case 'disconnected':
        break;
    }
    

  };

  //when a video or audio track was successfully retrieved from remote peer,
  //append the media stream to the remoteVideo HTMLElement
  peerConnection.ontrack = (e) => {
    console.log(e.track);
    console.log(e.streams);

    //once this point is reached, a p2p connection has successfully
    //been established and we are now receiving the other peer's media
    //stream

    e.track.onunmute = () => {
      //add stream(s)
      if(remoteVideo.srcObject) {
        return;
      }
      //only one stream is used (MediaStream from getUserDevices includes both video and audio)
      remoteVideo.srcObject = e.streams[0];
    }
   
  }

  //setup callbracks for signal server

  //when the intermediary server receives a RTCSessionDescription from 
  //remote client, check its type and perform appropriate logic
  signalServer.onReceiveSessionDescription = async (sdp) => {
    //sdp.type === 'answer' || 'offer' || 'rollback' || 'pranswer'

    //check to see if you are making an offer the same time as you receive a offer from another client
    const offerCollision = sdp.type === 'offer' && (makingOffer || peerConnection.signalingState !== 'stable');
    
    ignoreOffer = !isPolite && offerCollision;

    //ignore the offer sent to you if you are impolite and there is a collision.
    //the polite remote peer will accept the offer currently being sent by the impolite peer
    if(ignoreOffer) {
      return;
    }


    //update the remote description of the remote peer
    await peerConnection.setRemoteDescription(sdp);

    //if you are a polite peer or both peers are not sending offers at the same time,
    //send an answer to the remote peer
    if(sdp.type === 'offer') {
      await peerConnection.setLocalDescription(await peerConnection.createAnswer());
      signalServer.sendSessionDescription(peerConnection.localDescription!);
    }
  };

  signalServer.onReceiveNewIceCandidate = async (candidate) => {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch(e) {
      if(!ignoreOffer) {
        console.error(e);
      }
    }
  };

  //return callback to modify isPolite variable. This is because the signaling server
  //is responsible for assigning which client is polite or impolite
  return (polite: boolean) => {
    isPolite = polite;
  }

}
