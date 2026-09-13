import { PrismaClient } from "@prisma/client";
import "./env.js";

export const prisma = new PrismaClient();