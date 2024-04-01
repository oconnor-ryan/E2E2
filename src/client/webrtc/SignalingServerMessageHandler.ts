export abstract class SignalingServerMessageHandler {

  public onReceiveSessionDescription: (sdp: RTCSessionDescription) => void = (sdp) => {};
  public onReceiveNewIceCandidate: (candidate: RTCIceCandidateInit) => void = (can) => {};



  abstract sendSessionDescription(sdp: RTCSessionDescription): void;
  abstract sendNewIceCandidate(candidate: RTCIceCandidateInit): void;
}