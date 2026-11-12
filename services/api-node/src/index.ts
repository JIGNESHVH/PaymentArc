import cors from "cors";
import express from "express";
import { HOST, PORT } from "./config.js";
import { pollFxRates } from "./fx.js";
import { router } from "./routes.js";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Log incoming requests
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount routes
app.use(router);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.code || "INTERNAL_ERROR",
    message: err.message || "An unexpected error occurred",
  });
});

// Start initial FX poll
pollFxRates();

app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(` ArcPay Node.js API Service running on http://${HOST}:${PORT}`);
  console.log(` Health check: http://${HOST}:${PORT}/health`);
  console.log(` Config check: http://${HOST}:${PORT}/config`);
  console.log(`=======================================================`);
});
