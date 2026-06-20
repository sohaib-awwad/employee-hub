import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Secret used to sign the session cookie. Set COOKIE_SECRET in production.
const COOKIE_SECRET = process.env.COOKIE_SECRET ?? "dev-insecure-secret-change-me";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Tightened from a wide-open cors() so the session cookie can be sent with
// credentials. CLIENT_ORIGIN locks it to one origin in production; in dev the
// request origin is reflected (the frontend talks to us through Vite's proxy).
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? true,
    credentials: true,
  }),
);
app.use(cookieParser(COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the API also serves the built React SPA, so the whole app runs
// as a single service behind one URL (the frontend calls /api on the same
// origin). CLIENT_DIST overrides the location; the default is the frontend's
// build output relative to this bundle in the monorepo.
const serverDir = dirname(fileURLToPath(import.meta.url));
const clientDist = process.env.CLIENT_DIST
  ? resolve(process.env.CLIENT_DIST)
  : resolve(serverDir, "../../hr-portal/dist/public");

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: send index.html for any non-/api GET so client-side routes
  // (e.g. /admin/requests) work on a hard refresh. /api/* is excluded so
  // unknown API routes still 404 instead of returning HTML.
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
  logger.info({ clientDist }, "Serving static frontend");
}

export default app;
