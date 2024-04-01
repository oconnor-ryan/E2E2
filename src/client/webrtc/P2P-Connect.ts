import { SignalingServerMessageHandler } from "./SignalingServerMessageHandler.js";

//Two great links for explaining how peer-to-peer connections are established in WebRTC
//as well as how the "Perfect Negotiation" pattern is useful
//https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
//https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation


/**
 * Establish a peer-to-peer WebRTC connection between two users using the 
 * "Perfect Negotiation" pattern. Because of this pattern, this function can be
 * called regardless of whether the client is calling someone or receiving a call.
 * @param isPolite - impolite clients will always ignore offers on a offer collision and send their own offer, polite clients will always accept offers
 * @param signalServer - the intermediary server needed to help establish a direct connection between peers
 * @param remoteVideo - the video element to display video data from a remote peer
 * @param mediaTracks - this user's video and audio tracks from their webcam and microphone
 */
export function negotiateP2PConnection(signalServer: SignalingServerMessageHandler, remoteVideo: HTMLVideoElement, mediaStream: MediaStream) {
  //TODO: Use local STUN/TURN server since there are very few public TURN servers
  //urls: 'stun3.l.google.com', //use public STUN server provided by google.
  const peerConnection = new RTCPeerConnection({
  });

  let makingOffer = false; //since creating an offer is asyncronous, use this to check whether an offer is currently being made

  let ignoreOffer = false; //track whether or not the last offer processed was ignored

  let isPolite = true;

  //add media tracks
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
    //if something went wrong when retrieving ICE candidates,
    //try retrieving ICE candidates again
    if(peerConnection.iceConnectionState === 'failed') {
      peerConnection.restartIce();
    }
  };

  //when a video or audio track was successfully retrieved from remote peer,
  //append the media stream to the remoteVideo HTMLElement
  peerConnection.ontrack = (e) => {
    console.log(e.track);

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

  //return callback to modify isPolite variable
  return (polite: boolean) => {
    isPolite = polite;
  }

}
