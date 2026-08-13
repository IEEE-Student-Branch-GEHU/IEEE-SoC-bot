import User from "../models/User";
import PullRequest from "../models/PullRequest";
import { listMergedPullRequests, listPullRequestReviews, sleep, IBackfillPull } from "../utils/github";
import { awardPointsForMergedPR } from "./scoring";
import { getDifficultyFromLabels, getPointsForLabel } from "../utils/labels";

export interface IBackfillOptions {
  since?: string;
  perPage?: number;
  maxPages?: number;
  pageDelayMs?: number;
  backfillReviews?: boolean;
  reviewPageDelayMs?: number;
}

export interface IBackfillReport {
  repositoryName: string;
  found: number;
  newlyScored: number;
  alreadySynced: number;
  skippedUnregisteredAuthor: number;
  failed: number;
  pointsAwarded: number;
  coAuthorPointsAwarded: number;
  mentorReviewPointsAwarded: number;
  details: string[];
}

/**
 * Backfill historically merged pull requests for a single tracked repository.
 *
 * - Enumerates merged PRs via the GitHub REST API (paginated, rate-limit paced).
 * - Optionally enforces a `since` cutoff so pre-season PRs are ignored.
 * - Idempotent: PRs already stored as merged are skipped and never double-scored.
 * - Scores missing PRs through the SAME engine as the live webhook
 *   (awardPointsForMergedPR), but silently (no comments / Discord spam).
 * - Optionally backfills mentor review turnaround points from review history.
 */
export async function backfillRepository(
  repoDoc: any,
  options: IBackfillOptions = {}
): Promise<IBackfillReport> {
  const report: IBackfillReport = {
    repositoryName: repoDoc.fullName || repoDoc.name,
    found: 0,
    newlyScored: 0,
    alreadySynced: 0,
    skippedUnregisteredAuthor: 0,
    failed: 0,
    pointsAwarded: 0,
    coAuthorPointsAwarded: 0,
    mentorReviewPointsAwarded: 0,
    details: [],
  };

  if (!repoDoc.isActive) {
    report.details.push(`Repository is inactive. Skipping backfill.`);
    return report;
  }

  // 1. Enumerate historically merged PRs
  let pulls: IBackfillPull[] = [];
  try {
    pulls = await listMergedPullRequests(repoDoc.installationId, repoDoc.owner, repoDoc.name, {
      since: options.since,
      perPage: options.perPage,
      maxPages: options.maxPages,
      pageDelayMs: options.pageDelayMs,
    });
  } catch (err: any) {
    report.failed += 1;
    report.details.push(`Failed to fetch PR history: ${err.message}`);
    return report;
  }

  if (pulls.length === 0) {
    report.details.push(`No merged PRs found for repository '${report.repositoryName}'.`);
    return report;
  }

  report.found = pulls.length;

  // 2. Process each merged PR
  for (const pr of pulls) {
    const prNumber = pr.number;
    const prId = String(pr.id);
    const authorLogin = pr.user?.login;

    try {
      // Idempotency: skip PRs already recorded as merged
      const existingPr = await PullRequest.findOne({ prId });
      if (existingPr && existingPr.state === "merged") {
        report.alreadySynced += 1;
        report.details.push(`PR #${prNumber}: Already synced (${existingPr.difficultyLabel}). Skipped.`);
        continue;
      }

      // Only score PRs authored by registered fellows
      const authorDoc = authorLogin
        ? await User.findOne({ username: authorLogin, role: "fellow" })
        : null;
      if (!authorDoc) {
        report.skippedUnregisteredAuthor += 1;
        report.details.push(
          `PR #${prNumber}: Author @${authorLogin || "unknown"} is not a registered fellow. Skipped.`
        );
        continue;
      }

      // 3. Score the PR with the shared engine (silent mode)
      const result = await awardPointsForMergedPR(
        {
          installationId: repoDoc.installationId,
          owner: repoDoc.owner,
          repoName: repoDoc.name,
          repoDoc,
          prId,
          prNumber,
          title: pr.title,
          htmlUrl: pr.html_url,
          body: pr.body || undefined,
          labels: pr.labels || [],
          createdAt: pr.created_at,
          mergedAt: pr.merged_at || undefined,
          authorUsername: authorLogin,
          mergerUsername: pr.merged_by?.login || undefined,
          authorDoc,
          source: "backfill",
        },
        { notify: false }
      );

      report.newlyScored += 1;
      report.pointsAwarded += result.pointsAwarded;
      report.coAuthorPointsAwarded += result.coAuthorPointsAwarded;

      report.details.push(
        `PR #${prNumber}: Scored @${authorLogin} ${result.pointsAwarded > 0 ? `+${result.pointsAwarded}` : "0"} points (${result.difficulty})${result.isSuspicious ? " [flagged suspicious]" : ""}.`
      );

      // 4. Optional: backfill mentor review turnaround points (first review per PR)
      if (options.backfillReviews) {
        const prDoc = await PullRequest.findOne({ prId });
        if (prDoc && prDoc.reviews.length === 0) {
          const reviews = await listPullRequestReviews(
            repoDoc.installationId,
            repoDoc.owner,
            repoDoc.name,
            prNumber
          );

          if (options.reviewPageDelayMs) {
            await sleep(options.reviewPageDelayMs);
          }

          if (reviews.length > 0) {
            const firstReview = reviews[0];
            const reviewerDoc = await User.findOne({ username: firstReview.user.login });
            if (reviewerDoc && (reviewerDoc.role === "mentor" || reviewerDoc.role === "admin")) {
              const submittedAt = new Date(firstReview.submitted_at);
              const diffMs = submittedAt.getTime() - new Date(pr.created_at).getTime();
              const diffHours = diffMs / (1000 * 60 * 60);

              let earnedPoints = 0;
              if (diffHours <= 24) {
                earnedPoints = 15;
              } else if (diffHours <= 48) {
                earnedPoints = 5;
              }

              if (earnedPoints > 0) {
                await User.updateOne(
                  { _id: reviewerDoc._id },
                  { $inc: { mentorScore: earnedPoints } }
                );
                report.mentorReviewPointsAwarded += earnedPoints;

                prDoc.reviews.push({
                  reviewer: reviewerDoc._id,
                  state: firstReview.state.toUpperCase(),
                  submittedAt,
                });
                prDoc.turnaroundTimeSeconds = Math.max(0, Math.floor(diffMs / 1000));
                await prDoc.save();

                report.details.push(
                  `PR #${prNumber}: Mentor @${reviewerDoc.username} earned +${earnedPoints} review points (backfilled, turnaround ${diffHours.toFixed(1)}h).`
                );
              }
            }
          }
        }
      }
    } catch (err: any) {
      report.failed += 1;
      report.details.push(`PR #${prNumber}: Failed to process — ${err.message}`);
    }
  }

  return report;
}

export async function getPointsPreviewForPR(pr: IBackfillPull): Promise<number> {
  return getPointsForLabel(getDifficultyFromLabels(pr.labels || []));
}