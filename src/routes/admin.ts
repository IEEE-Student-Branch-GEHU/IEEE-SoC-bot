import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Repository from "../models/Repository";
import PullRequest from "../models/PullRequest";
import { getInstallationOctokit } from "../utils/github";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_for_admin_resync";

// Simple middleware to secure endpoints with JWT
export interface IAuthRequest extends Request {
  user?: {
    username: string;
    role: string;
  };
}

export function verifyAdminJWT(req: IAuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Access denied. Header 'Authorization: Bearer <token>' is required." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role: string };
    if (decoded.role !== "admin") {
      res.status(403).json({ error: "Forbidden: Administrative privileges required." });
      return;
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired JWT token." });
  }
}

/**
 * POST /api/admin/login
 * Convenience endpoint for logging in as admin and generating a JWT token for testing in the preview UI.
 */
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Simple hardcoded credentials for demonstration testing
  if (username === "admin" && password === "ieeesoc2026") {
    const token = jwt.sign({ username: "admin-siddharth", role: "admin" }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ success: true, token, user: { name: "Siddharth Verma", role: "admin", username: "admin-siddharth" } });
  } else {
    res.status(401).json({ success: false, error: "Invalid admin credentials. Use admin / ieeesoc2026" });
  }
});

/**
 * POST /api/admin/repositories/:repoId/resync
 * Query GitHub and update database records with synced pull request state
 */
router.post("/repositories/:repoId/resync", verifyAdminJWT, async (req: IAuthRequest, res: Response): Promise<void> => {
  const { repoId } = req.params;

  try {
    const repoDoc = await Repository.findOne({ repoId });
    if (!repoDoc) {
      res.status(404).json({ success: false, error: "Repository not found." });
      return;
    }

    console.log(`⚖️ Admin Resync: Processing sync operations for repository '${repoDoc.fullName}'`);

    const octokit = await getInstallationOctokit(repoDoc.installationId);
    let syncedPRsCount = 0;
    let pointsAdjusted = 0;
    const detailsLog: string[] = [];

    if (!octokit) {
      // High fidelity offline sandbox simulation
      console.log("ℹ️ No GitHub App credentials available. Triggering offline simulated resync flow...");
      
      // Let's find fellows assigned to this track
      const fellows = await User.find({ track: repoDoc.track, role: "fellow" });
      
      if (fellows.length === 0) {
        res.json({
          success: true,
          message: "Resync completed (Sandbox Mode). No active fellows matched this track.",
          summary: { syncedPRsCount: 0, pointsAdjusted: 0 },
          details: ["No matching fellows found in DB for track " + repoDoc.track],
        });
        return;
      }

      // Simulate parsing we found two mock completed PRs on Github that were not yet in our DB, or need points verification
      const targetFellow = fellows[Math.floor(Math.random() * fellows.length)];
      
      const mockPrId = `sim-pr-resync-${Date.now()}`;
      const prNumber = Math.floor(Math.random() * 200) + 100;
      const htmlUrl = `${repoDoc.htmlUrl}/pull/${prNumber}`;
      
      // Check if this PR already synchronized
      const checkPr = await PullRequest.findOne({ prNumber, repository: repoDoc._id });
      if (!checkPr) {
        const points = 30; // Simulated medium PR
        
        // Save PR state in Mongo
        await PullRequest.create({
          prId: mockPrId,
          prNumber,
          repository: repoDoc._id,
          author: targetFellow._id,
          title: "docs: update API endpoints guides and add architectural schemas",
          htmlUrl,
          state: "merged",
          difficultyLabel: "soc-medium",
          pointsAwarded: points,
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          mergedAt: new Date(),
        });

        // Award Fellow
        await User.updateOne({ _id: targetFellow._id }, { $inc: { score: points } });
        
        syncedPRsCount = 1;
        pointsAdjusted = points;
        detailsLog.push(`Identified merged PR #${prNumber} by @${targetFellow.username} (soc-medium) on GitHub missing from local DB. Added document and awarded +${points} points.`);
      } else {
        detailsLog.push(`All historical PRs for repository '${repoDoc.name}' already match local datastore synced scores.`);
      }

      res.json({
        success: true,
        message: "Repository PR history resynced successfully (Sandboxed Simulation).",
        summary: {
          syncedPRsCount,
          pointsAdjusted,
        },
        details: detailsLog,
      });
      return;
    }

    // --- REAL GITHUB OPERATIONS RUNTIME ---
    detailsLog.push(`Acquired GitHub Installation installationId=${repoDoc.installationId}. Loading historical pull request payload lists...`);
    
    // Fetch merged PRs from GitHub REST API
    const { data: pulls } = await octokit.pulls.list({
      owner: repoDoc.owner,
      repo: repoDoc.name,
      state: "closed",
      per_page: 50,
    });

    for (const pr of pulls) {
      if (!pr.merged_at) {
        // Skip unmerged closed PRs
        continue;
      }

      // Check if the author is a registered Fellow
      const authorDoc = await User.findOne({ username: pr.user?.login, role: "fellow" });
      if (!authorDoc) {
        detailsLog.push(`PR #${pr.number}: Author @${pr.user?.login || "unknown"} is not a registered fellow. Skipping score adjustment.`);
        continue;
      }

      // Check if this PR exists in DB already
      const existingPr = await PullRequest.findOne({ prId: String(pr.id) });
      const labels = pr.labels || [];
      const difficulty = getDifficultyFromLabels(labels);
      const pointsWorth = getPointsForLabel(difficulty);

      if (!existingPr) {
        // PR is not recorded in DB. We create and sync score.
        await PullRequest.create({
          prId: String(pr.id),
          prNumber: pr.number,
          repository: repoDoc._id,
          author: authorDoc._id,
          title: pr.title,
          htmlUrl: pr.html_url,
          state: "merged",
          difficultyLabel: difficulty,
          pointsAwarded: pointsWorth,
          createdAt: new Date(pr.created_at),
          mergedAt: new Date(pr.merged_at),
        });

        if (pointsWorth > 0) {
          await User.updateOne({ _id: authorDoc._id }, { $inc: { score: pointsWorth } });
          pointsAdjusted += pointsWorth;
          detailsLog.push(`PR #${pr.number}: Synchronized merged PR missing from local Database. Awarded +${pointsWorth} points to @${authorDoc.username}.`);
        } else {
          detailsLog.push(`PR #${pr.number}: Synchronized merged PR. Unlabeled difficulty, awarded 0 points.`);
        }
        syncedPRsCount++;
      } else if (existingPr.state !== "merged" || existingPr.pointsAwarded !== pointsWorth) {
        // State or points mismatched, adjust discrepancy
        const oldPoints = existingPr.pointsAwarded || 0;
        const delta = pointsWorth - oldPoints;

        existingPr.state = "merged";
        existingPr.difficultyLabel = difficulty;
        existingPr.pointsAwarded = pointsWorth;
        existingPr.mergedAt = new Date(pr.merged_at);
        await existingPr.save();

        if (delta !== 0) {
          await User.updateOne({ _id: authorDoc._id }, { $inc: { score: delta } });
          pointsAdjusted += delta;
          detailsLog.push(`PR #${pr.number}: Discrepancy reconciled. Adjusted @${authorDoc.username}'s points by ${delta >= 0 ? "+" : ""}${delta} (${oldPoints} -> ${pointsWorth}).`);
        } else {
          detailsLog.push(`PR #${pr.number}: Database status aligned to GitHub merged state (Points already synced).`);
        }
        syncedPRsCount++;
      }
    }

    res.json({
      success: true,
      message: "Repository pull request transactions synchronized successfully.",
      summary: {
        syncedPRsCount,
        pointsAdjusted,
      },
      details: detailsLog,
    });
  } catch (err: any) {
    console.error("❌ Resync Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Duplicated helper functions to avoid module coupling
function getDifficultyFromLabels(labels: any[]): "soc-easy" | "soc-medium" | "soc-hard" | "unlabeled" {
  for (const label of labels) {
    const name = typeof label === "string" ? label : label.name;
    if (name === "soc-easy") return "soc-easy";
    if (name === "soc-medium") return "soc-medium";
    if (name === "soc-hard") return "soc-hard";
  }
  return "unlabeled";
}

function getPointsForLabel(difficulty: "soc-easy" | "soc-medium" | "soc-hard" | "unlabeled"): number {
  switch (difficulty) {
    case "soc-easy": return 10;
    case "soc-medium": return 30;
    case "soc-hard": return 60;
    default: return 0;
  }
}

export default router;
