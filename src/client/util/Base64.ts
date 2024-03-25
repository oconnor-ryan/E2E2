/*
Convert an ArrayBuffer into a string
from https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
*/
function ab2str(buf: ArrayBuffer) {
  //make sure to use Uint8Array because base64 only supports binary to ASCII, not Unicode.
  //ASCII characters are 8-bits, so use Uint8Array
  //@ts-ignore
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

//https://developer.mozilla.org/en-US/docs/Glossary/Base64
//https://base64.guru/standards/base64url
//Use this when putting a base64 message inside a URL
function base64ToBase64URL(base64: string) {
  //replace + with -
  //replace / with _ 
  //omit padding character = at end of string (can end with ==, =, or zero =)
  return base64.replace(/(\+)/g, "-").replace(/(\/)/g, "_").replace(/(=)/g, "");
}

function base64URLToBase64(base64URL: string) {
  //replace - with +
  //replace _ with /
  //no need to add = for padding since Javascript's atob function can
  //convert base64 to binary regardless of whether there is padding or not
  //if needed, you can use an asterisk * instead of =
  return base64URL.replace(/(\-)/g, "+").replace(/(\_)/g, "/");
}

export function arrayBufferToBase64(buffer: ArrayBuffer, urlSafe = false) : string {
  let val = btoa(ab2str(buffer));
  if(urlSafe) {
    val = base64ToBase64URL(val);
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

export function test() {
  //base64 string will end with a certain number of = signs.
  //The number of = can be found using the following equation 
  // # of equal signs = (stringLength) % 3
  let message = window.crypto.getRandomValues(new Uint8Array(22));

  console.log("Original Message");
  console.log(message);

  let base64 = arrayBufferToBase64(message);

  console.log("Base64 of Message:");
  console.log(base64);

  console.log("Base64URL of Message:");
  base64 = arrayBufferToBase64(message, true);
  console.log(base64);

  //test if base64URL can be placed into a URL without messing with its
  //format
  let url = new URL("?data="+base64, "http://test.com");

  console.log("Base64URL From URL:");
  let base64FromUrl = url.searchParams.get("data")!;
  console.log(base64FromUrl);

  //decode the original message from the base64URL
  console.log("Original Message from Base64URL:");
  let oldMessageFromURL = new Uint8Array(base64ToArrayBuffer(base64URLToBase64(base64FromUrl)));
  console.log(oldMessageFromURL);

  //check if decoded message from URL is identical to original message
  let areSame = oldMessageFromURL.byteLength == message.byteLength;
  //if messages are same length, check each byte to see if they are equal
  if(areSame) {
    for(let i = 0; i < message.length; i++) {
      if(oldMessageFromURL[i] !== message[i]) {
        areSame = false;
        break;
      }
    }
  }
  console.log("Original Message = Original Message from Base64URL:", areSame);

}
