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
      expiresIn: '2d' //2 days
    }
  )
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