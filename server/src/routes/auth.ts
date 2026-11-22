import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { pool } from "../db.js";

export type ResponderRole = "admin" | "dispatcher" | "viewer";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(8).max(128),
});

const jwtSecret = process.env.BEACON_JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("BEACON_JWT_SECRET is required in production");
}
const secret = new TextEncoder().encode(
  jwtSecret ?? "development-only-secret-change-before-production",
);

function cookieValue(req: Request, name: string): string | undefined {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

async function signToken(subject: string, role: ResponderRole, type: "access" | "refresh") {
  return new SignJWT({ role, type })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(type === "access" ? "15m" : "7d")
    .sign(secret);
}

export const auth = Router();

auth.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid credentials" });

  const { username, password } = parsed.data;
  const result = await pool.query(
    `SELECT id, username, password_hash, role, disabled, failed_attempts, locked_until
     FROM responder_users WHERE username=$1`,
    [username],
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  if (user.disabled) return res.status(403).json({ error: "account disabled" });
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return res.status(423).json({ error: "account temporarily locked" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = Number(user.failed_attempts ?? 0) + 1;
    await pool.query(
      `UPDATE responder_users
       SET failed_attempts=$1,
           locked_until=CASE WHEN $1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
           updated_at=now()
       WHERE id=$2`,
      [attempts, user.id],
    );
    return res.status(401).json({ error: "invalid credentials" });
  }

  await pool.query(
    `UPDATE responder_users
     SET failed_attempts=0, locked_until=NULL, updated_at=now()
     WHERE id=$1`,
    [user.id],
  );
  const role = user.role as ResponderRole;
  const accessToken = await signToken(user.id, role, "access");
  const refreshToken = await signToken(user.id, role, "refresh");
  res.cookie("beacon_refresh", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ accessToken, role, userId: user.id });
});

auth.post("/refresh", async (req, res) => {
  const refreshToken = cookieValue(req, "beacon_refresh");
  if (!refreshToken) return res.status(401).json({ error: "refresh token required" });
  try {
    const verified = await jwtVerify(refreshToken, secret);
    if (verified.payload.type !== "refresh" || typeof verified.payload.sub !== "string") {
      return res.status(401).json({ error: "invalid refresh token" });
    }
    const role = verified.payload.role as ResponderRole;
    if (!["admin", "dispatcher", "viewer"].includes(role)) {
      return res.status(401).json({ error: "invalid role" });
    }
    const accessToken = await signToken(verified.payload.sub, role, "access");
    res.json({ accessToken, role });
  } catch {
    res.status(401).json({ error: "invalid refresh token" });
  }
});

auth.post("/logout", (_req, res) => {
  res.clearCookie("beacon_refresh", { httpOnly: true, sameSite: "strict" });
  res.json({ ok: true });
});

export function requireRole(...allowed: ResponderRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "access token required" });
    try {
      const verified = await jwtVerify(token, secret);
      if (verified.payload.type !== "access")
        return res.status(401).json({ error: "invalid access token" });
      const role = verified.payload.role as ResponderRole;
      if (!allowed.includes(role)) return res.status(403).json({ error: "forbidden" });
      (req as Request & { responderRole?: ResponderRole }).responderRole = role;
      next();
    } catch {
      res.status(401).json({ error: "invalid access token" });
    }
  };
}
