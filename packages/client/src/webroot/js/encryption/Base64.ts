/*
Convert an ArrayBuffer into a string
from https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
*/
function ab2str(buf: ArrayBuffer) {
  //@ts-ignore
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// https://developer.mozilla.org/en-US/docs/Glossary/Base64
//Use this when putting a base64 message inside a URL
function makeURLSafe(base64: string) {
  //replace +/ with -_ and omit padding character =
  return base64.replace(/(\+\/)/g, "-_").replace(/(=)/g, "");
}
export function arrayBufferToBase64(buffer: ArrayBuffer, urlSafe = false) : string {
  let val = btoa(ab2str(buffer));
  if(urlSafe) {
    val = makeURLSafe(val);
  }
  return val;
}


export function base64ToArrayBuffer(base64: string) : ArrayBuffer {
  let binaryString = atob(base64);
  let rtn = new Uint8Array(binaryString.length);

  for(let i = 0; i < binaryString.length; i++) {
    rtn[i] = binaryString.charCodeAt(i);
  }

  return rtn.buffer;
}