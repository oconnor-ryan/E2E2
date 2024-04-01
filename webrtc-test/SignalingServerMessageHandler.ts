export abstract class SignalingServerMessageHandler {

  public onReceiveSessionDescription: (sdp: RTCSessionDescription) => void;
  public onReceiveNewIceCandidate: (candidate: RTCIceCandidateInit) => void;



  abstract sendSessionDescription(sdp: RTCSessionDescription): void;
  abstract sendNewIceCandidate(candidate: RTCIceCandidateInit): void;
}