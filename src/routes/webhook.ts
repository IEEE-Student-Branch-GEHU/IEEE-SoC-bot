import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { webhookQueue, deduplicator } from "../config/redis";

const router = Router();

// Custom interface to capture raw body for HMAC verification
export interface IVerifiedRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Validates the HMAC SHA-256 signature from GitHub webhook headers
 */
function verifyGitHubSignature(req: IVerifiedRequest, res: Response, next: NextFunction): void {
  const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

  // Bypass checks in local simulated run if no secret is active, aiding easy preview testing.
  if (!GITHUB_WEBHOOK_SECRET || GITHUB_WEBHOOK_SECRET === "your_github_webhook_secret_here") {
    console.warn("⚠️ GITHUB_WEBHOOK_SECRET is not configured. Webhook signature checking bypassed.");
    return next();
  }

  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) {
    res.status(401).json({ error: "Missing x-hub-signature-256 header." });
    return;
  }

  if (!req.rawBody) {
    res.status(400).json({ error: "Unable to verify signature: Request rawBody empty." });
    return;
  }

  try {
    const computedHmac = "sha256=" + crypto
      .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    // Timing-safe equal check to protect against timing attacks
    const computedBuf = Buffer.from(computedHmac);
    const signatureBuf = Buffer.from(signature);

    if (computedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(computedBuf, signatureBuf)) {
      console.warn("❌ Webhook HMAC-SHA256 signature verification failed.");
      res.status(401).json({ error: "Invalid HMAC-SHA256 hook signature." });
      return;
    }

    console.log("🔒 Webhook HMAC signature verified successfully.");
    next();
  } catch (err: any) {
    console.error("❌ Cryptographic verification error:", err.message);
    res.status(500).json({ error: "Failed to perform cryptographic validation." });
  }
}

/**
 * POST /api/bot/webhook
 * Ingests incoming GitHub webhook payloads asynchronously.
 */
router.post("/webhook", verifyGitHubSignature, async (req: Request, res: Response): Promise<void> => {
  const deliveryId = req.headers["x-github-delivery"] as string;
  const event = req.headers["x-github-event"] as string;

  if (!deliveryId) {
    res.status(400).json({ error: "Missing required X-GitHub-Delivery header." });
    return;
  }

  try {
    // 1. Webhook Deduplication Check
    const activeDuplicate = await deduplicator.isDuplicate(deliveryId);
    if (activeDuplicate) {
      console.log(`♻️ Deduplication check triggered: Webhook ID '${deliveryId}' already processed. Skipping.`);
      res.status(200).send("Duplicate");
      return;
    }

    // Attach Event Metadata so our queue worker can identify context
    const jobPayload = {
      ...req.body,
      _event: event,
      _deliveryId: deliveryId,
    };

    // 2. Queue Asynchronously
    const job = await webhookQueue.add("github-webhook", jobPayload);

    console.log(`🚀 Webhook enqueued. Task: ${job.id}. SLA responded 202 Accepted.`);
    res.status(202).json({
      status: "Accepted",
      message: "Webhook event enqueued successfully",
      jobId: job.id,
    });
  } catch (err: any) {
    console.error("❌ Failed to process webhook ingestion:", err.message);
    res.status(500).json({ error: "Failed to enqueue webhook payload." });
  }
});

export default router;
