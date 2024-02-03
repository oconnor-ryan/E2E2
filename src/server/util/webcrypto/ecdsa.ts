import crypto from 'crypto'

export async function importSignKey(keyBase64: string) {
  let buf = Buffer.from(keyBase64, 'base64');
  return await crypto.subtle.importKey(
    'spki', 
    buf, 
    {
      name: 'ECDSA',
      namedCurve: 'P-521',
    },
    false,
    ['verify']
  );
}

export async function verifyKey(signatureBase64: string, pubKeyBase64: string) {
  try {
    let pubKey = await importSignKey(pubKeyBase64);

    let verified = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: {name: 'SHA-512'}
      },
      pubKey,
      Buffer.from(signatureBase64, 'base64'), //the signature is the part we want to check
      Buffer.from("") //just use empty data
    );

    return verified;
  } catch(e) {
    console.error(e);
    return false;
  }
}