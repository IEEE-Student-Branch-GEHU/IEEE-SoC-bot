import { Router, Request, Response } from "express";
import User from "../models/User";
import PullRequest from "../models/PullRequest";

const router = Router();

/**
 * GET /api/leaderboard
 * Returns paginated user rankings filterable by track.
 * Query Params:
 *  - track: string ('AI', 'Full-Stack', 'DevOps', 'Security', 'Frontier')
 *  - page: number (default: 1)
 *  - limit: number (default: 10)
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const { track, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build filter object for roles matching fellows
    const filter: any = { role: "fellow" };
    if (track) {
      filter.track = track;
    }

    // Step 1: Count total matching fellows for page metadata
    const totalCount = await User.countDocuments(filter);

    // Step 2: Fetch fellows sorted by points (descending)
    const fellows = await User.find(filter)
      .sort({ score: -1, joinedAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Step 3: Efficiently fetch the number of merged pull requests for these users
    const fellowIds = fellows.map((f) => f._id);
    const prCounts = await PullRequest.aggregate([
      {
        $match: {
          author: { $in: fellowIds },
          state: "merged",
        },
      },
      {
        $group: {
          _id: "$author",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create lookup map of authorId -> mergedCount
    const prCountMap = new Map<string, number>();
    prCounts.forEach((record) => {
      prCountMap.set(String(record._id), record.count);
    });

    // Step 4: Map rank and assign fields
    // Rank offset must match current page relative ranking position
    const baseRank = skip + 1;
    const rankings = fellows.map((fellow, index) => ({
      rank: baseRank + index,
      _id: fellow._id,
      githubId: fellow.githubId,
      username: fellow.username,
      name: fellow.name,
      track: fellow.track,
      score: fellow.score,
      avatarUrl: fellow.avatarUrl,
      mergedPRCount: prCountMap.get(String(fellow._id)) || 0,
    }));

    res.json({
      success: true,
      data: rankings,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err: any) {
    console.error("❌ Leaderboard Fetch Error:", err);
    res.status(500).json({ success: false, error: "Failed to assemble leaderboard rankings." });
  }
});

/**
 * GET /api/stats
 * Helper API to fetch general tracking details for displaying real-time counters in the UI
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const totalPRs = await PullRequest.countDocuments();
    const mergedPRs = await PullRequest.countDocuments({ state: "merged" });
    const totalFellows = await User.countDocuments({ role: "fellow" });
    const suspiciousCount = await PullRequest.countDocuments({ suspicious: true });

    // Sum points awarded
    const ptsAwarded = await PullRequest.aggregate([
      { $group: { _id: null, total: { $sum: "$pointsAwarded" } } }
    ]);
    const totalPoints = ptsAwarded[0]?.total || 0;

    res.json({
      success: true,
      stats: {
        totalPRs,
        mergedPRs,
        totalFellows,
        suspiciousCount,
        totalPoints
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
