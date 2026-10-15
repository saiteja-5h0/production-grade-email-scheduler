import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { hasAuthenticatedSession } from "./access-control.js";

export const SESSION_COOKIE = "reachinbox_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      isAuthenticated?: boolean;
    }
  }
}

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "30d" });
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    req.isAuthenticated = false;

    if (typeof token !== "string") {
      return next();
    }

    let userId: string;
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
        return next();
      }
      userId = payload.sub;
    } catch {
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next();

    req.user = { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
    req.isAuthenticated = true;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!hasAuthenticatedSession(req)) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  return next();
}