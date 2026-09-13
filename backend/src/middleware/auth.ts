import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "reachinbox_session";
const DEMO_USER_EMAIL = "demo@reachinbox.local";

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

async function getOrCreateDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { id: "demo-user", name: "Demo User", email: DEMO_USER_EMAIL },
  });
}

/**
 * Attaches req.user for every request.
 * - If a valid session cookie is present, the real logged-in user is attached and
 *   req.isAuthenticated = true.
 * - Otherwise a shared demo user is attached (isAuthenticated = false) so the API
 *   keeps working for local/Postman testing without requiring login.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];

    if (token) {
      try {
        const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });

        if (user) {
          req.user = { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
          req.isAuthenticated = true;
          return next();
        }
      } catch {
        // invalid/expired token -> fall through to demo user
      }
    }

    const demo = await getOrCreateDemoUser();
    req.user = { id: demo.id, name: demo.name, email: demo.email, avatar: demo.avatar };
    req.isAuthenticated = false;
    next();
  } catch (error) {
    next(error);
  }
}
