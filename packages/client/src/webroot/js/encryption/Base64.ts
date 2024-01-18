/*
Convert an ArrayBuffer into a string
from https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
*/
function ab2str(buf: ArrayBuffer) {
  //@ts-ignore
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

export function arrayBufferToBase64(buffer: ArrayBuffer) : string {
  return btoa(ab2str(buffer));
}


export function base64ToArrayBuffer(base64: string) : ArrayBuffer {
  let binaryString = atob(base64);
  let rtn = new Uint8Array(binaryString.length);

  for(let i = 0; i < binaryString.length; i++) {
    rtn[i] = binaryString.charCodeAt(i);
  }

  return rtn.buffer;
}