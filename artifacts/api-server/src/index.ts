import app from "./app";
import { logger } from "./lib/logger";
import { sweepExpiredPunches } from "./lib/attendance";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Enforce the 12-hour cap even when nobody has the app open: periodically
  // auto punch-out any shift left running past the limit (and once now).
  const SWEEP_MS = 5 * 60 * 1000;
  let sweeping = false;
  const runSweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      const closed = await sweepExpiredPunches();
      if (closed > 0) logger.info({ closed }, "Auto punch-out: closed shifts past the 12h limit");
    } catch (sweepErr) {
      logger.error({ err: sweepErr }, "Auto punch-out sweep failed");
    } finally {
      sweeping = false;
    }
  };
  void runSweep();
  setInterval(runSweep, SWEEP_MS);
});
