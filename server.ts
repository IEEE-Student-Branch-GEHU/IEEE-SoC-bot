import express from "express";
import path from "path";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { initializeRedisAndQueue, jobLogsState } from "./src/config/redis";
import { githubSimLogs } from "./src/utils/github";
import webhookRouter from "./src/routes/webhook";
import leaderboardRouter from "./src/routes/leaderboard";
import adminRouter from "./src/routes/admin";

// Load Environment Variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // 1. Database Connections
  await connectDB();
  initializeRedisAndQueue();

  // 2. Parsers - Attach raw request body to req.rawBody to support cryptographic signature verification
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // 3. API Endpoints
  app.use("/api/bot", webhookRouter);
  app.use("/api", leaderboardRouter);
  app.use("/api/admin", adminRouter);

  // Helper endpoint for frontend: Get background task logs
  app.get("/api/job-logs", (_req, res) => {
    res.json({ success: true, logs: jobLogsState });
  });

  // Helper endpoint for frontend: Get simulated activity logs
  app.get("/api/github-logs", (_req, res) => {
    res.json({ success: true, logs: githubSimLogs });
  });

  // Helper endpoint for frontend: Force-clear simulation logs
  app.post("/api/admin/clear-logs", (_req, res) => {
    jobLogsState.length = 0;
    githubSimLogs.length = 0;
    res.json({ success: true });
  });

  // 4. Vite Dev Server Integration vs Production Static Build Routing
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("⚡ Vite development middleware injected successfully.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("📦 Production static assets mounted from 'dist/' directory.");
  }

  // 5. Port Listening - Bind specifically to 0.0.0.0 on Port 3000 as requested
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🤖 IEEEsoc-Bot Server is online & listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("❌ Failed to launch IEEEsoc-Bot controller server:", err);
  process.exit(1);
});
