let videoContainer = document.getElementById('video-container') as HTMLVideoElement;

(async () => {
  let MEDIA_CONSTRAINTS = {
    audio: true,
    video: {
      aspectRatio: {
        ideal: 1.333333
      }
    }
  };

  let webcamStream = await window.navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);

  videoContainer.srcObject = webcamStream;

})();