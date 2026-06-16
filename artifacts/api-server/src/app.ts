import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
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

export default app;
