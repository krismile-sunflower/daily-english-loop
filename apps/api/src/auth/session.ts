import { SignJWT, jwtVerify } from "jose";

const secretText = process.env.JWT_SECRET ?? "dev-secret-change-before-production";
const secret = new TextEncoder().encode(secretText);

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify(token, secret);
  const userId = result.payload.sub;
  return typeof userId === "string" ? userId : null;
}
