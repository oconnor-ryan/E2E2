import crypto from 'crypto';

export function hashPassword(password: string, salt?: Buffer) {
  //if no salt is provided, randomly generate it
  if(!salt) {
    salt = crypto.randomBytes(20);
  }

  return new Promise<{hash: string, salt: string}>((resolve, reject) => {
    crypto.hkdf('sha-512', password, salt!, 'accessToken', 128, (err, key) => {
      if(err) {
        return reject(err);
      }

      resolve({
        hash: Buffer.from(key).toString('base64'),
        salt: salt!.toString('base64')
      });
    });
  });
  
}

export function combineSaltAndHash(hashBase64: string, saltBase64: string) {
  return saltBase64 + hashBase64;
}

export async function passwordCorrect(plaintextPassword: string, hashBase64: string, saltBase64: string) {
  try {
    let {hash} = await hashPassword(plaintextPassword, Buffer.from(saltBase64, 'base64'));
    return hash === hashBase64; 
  } catch(e) {
    return false;
  }

}