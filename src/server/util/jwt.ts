import jwt, { JwtPayload } from 'jsonwebtoken';

interface Payload {
  username: string
}

export function getToken(payload: Payload) {
  return jwt.sign(
    payload, 
    process.env.JWT_SECRET!, 
    {
      algorithm: 'HS256',
      expiresIn: '1h' //1 hour
    }
  )
}

export function getExpDate(token: string) {
  //decode JWT without verifying it is valid
  let decodedJWT = jwt.decode(
    token, 
    {
      complete: true
    }
  );
  if(!decodedJWT) {
    return null;
  }

  let payload = decodedJWT.payload as JwtPayload;

  //exp stores the number of SECONDS from epoch instead of MILLISECONDS like
  //normal Javascript Dates, so multiple seconds by 1000 to get milliseconds
  return new Date(payload.exp! * 1000);
}

export function verifyToken(token: string) : Payload | null {
  try {
    let payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return payload as Payload;
  } catch(e: any) {
    console.error(e);
    return null;
  }
}