import User from "../models/User";
import PullRequest from "../models/PullRequest";
import { postGitHubPRComment, getPullRequestFilesCount, getPullRequestCommits, postDiscordAlert } from "../utils/github";
import { getDifficultyFromLabels, getPointsForLabel, DifficultyLabel } from "../utils/labels";

/**
 * Reusable scoring engine for a merged pull request.
 *
 * Designed to be shared by the live webhook worker (real-time events) and the
 * historical backfill service so both award points through the exact same rules:
 * self-merge detection, difficulty labels, low-effort heuristics and co-author splits.
 *
 * `notify` controls side effects like PR comments and Discord alerts. Backfill passes
 * `false` so historical PRs are scored silently while live webhooks keep the full
 * notification behavior.
 */
export interface IMergedPRInput {
  installationId: string;
  owner: string;
  repoName: string;
  repoDoc: any;
  prId: string;
  prNumber: number;
  title: string;
  htmlUrl: string;
  body?: string;
  labels: any[];
  createdAt: string;
  mergedAt?: string;
  authorUsername: string;
  mergerUsername?: string;
  authorDoc: any;
  source?: "webhook" | "backfill";
}

export interface IMergedPRResult {
  pointsAwarded: number;
  isSuspicious: boolean;
  coAuthorPointsAwarded: number;
  difficulty: DifficultyLabel;
}

export async function awardPointsForMergedPR(
  input: IMergedPRInput,
  options: { notify?: boolean } = {}
): Promise<IMergedPRResult> {
  const notify = options.notify ?? true;

  const {
    installationId,
    owner,
    repoName,
    repoDoc,
    prId,
    prNumber,
    title,
    htmlUrl,
    body,
    labels,
    createdAt,
    mergedAt,
    authorUsername,
    mergerUsername,
    authorDoc,
    source,
  } = input;

  console.log(`🎉 [Scoring] Awarding points for merged Pull Request #${prNumber} (source: ${source || "webhook"})`);

  const difficulty = getDifficultyFromLabels(labels);
  let isSuspicious = false;
  let pointsAwarded = 0;
  let coAuthorPointsAwarded = 0;

  // A. Self-Merge Check
  if (mergerUsername === authorUsername) {
    isSuspicious = true;
    pointsAwarded = 0;

    if (notify) {
      const warningComment = `⚠️ **Anti-Cheat Warning** @${authorUsername}: You self-merged your own Pull Request without an independent mentor approval review. 0 points have been awarded and this event has been flagged.`;
      await postGitHubPRComment(installationId, owner, repoName, prNumber, warningComment);
      await postDiscordAlert(
        `🚨 **Suspicious Activity Flagged**\n@${authorUsername} self-merged their own Pull Request (**PR #${prNumber}**). Awarded 0 points.`,
        "warning"
      );
    }
  } else {
    // Calculate normal award points based on label
    const basePoints = getPointsForLabel(difficulty);
    pointsAwarded = basePoints;

    // B. Low effort check (Medium or Hard difficulty but < 5 changes lines)
    const lineChanges = await getPullRequestFilesCount(installationId, owner, repoName, prNumber);
    const totalDiffCount = lineChanges.additions + lineChanges.deletions;

    let effortNote = "";
    if ((difficulty === "soc-medium" || difficulty === "soc-hard") && totalDiffCount < 5) {
      effortNote = `\n⚠️ *Caution: Labeled ${difficulty} but diff has only ${totalDiffCount} line changes.*`;
      isSuspicious = true; // flagged for investigation
    }

    // C. Parse Commits for Co-Authors
    const commits = await getPullRequestCommits(installationId, owner, repoName, prNumber);
    const coAuthors: string[] = [];
    const coAuthorDocs: any[] = [];

    for (const commit of commits) {
      const matches = [...commit.message.matchAll(/Co-authored-by:\s*([^\s<]+)\s*<([^>]+)>/gi)];
      for (const match of matches) {
        const caUsername = match[1];
        const caEmail = match[2];

        if (caUsername !== authorUsername && !coAuthors.includes(caUsername)) {
          const coAuthorUser = await User.findOne({
            $or: [{ username: caUsername }, { email: caEmail }],
            role: "fellow",
          });
          if (coAuthorUser) {
            coAuthors.push(caUsername);
            coAuthorDocs.push(coAuthorUser);
          }
        }
      }
    }

    // Increment values in DB
    if (pointsAwarded > 0) {
      // Author receives 100%
      await User.updateOne({ _id: authorDoc._id }, { $inc: { score: pointsAwarded } });

      // Co-authors receive 50%
      const coAuthorPoints = Math.round(pointsAwarded * 0.5);
      for (const caDoc of coAuthorDocs) {
        await User.updateOne({ _id: caDoc._id }, { $inc: { score: coAuthorPoints } });
        coAuthorPointsAwarded += coAuthorPoints;
        if (notify) {
          const coAuthorPrComment = `🤖 @${caDoc.username} awarded **+${coAuthorPoints} points** (50% co-author split) for contributing to PR #${prNumber}!`;
          await postGitHubPRComment(installationId, owner, repoName, prNumber, coAuthorPrComment);
        }
      }

      // Post success comment on PR
      if (notify) {
        const successComment = `🤖 @${authorUsername} awarded **+${pointsAwarded} points** for completing a \`${difficulty}\` contribution! 🏆${coAuthors.length > 0 ? ` Co-authors awarded points: ${coAuthors.map(c => "@" + c).join(", ")}.` : ""}`;
        await postGitHubPRComment(installationId, owner, repoName, prNumber, successComment);
      }
    } else if (difficulty === "unlabeled") {
      // Lacking tags
      if (notify) {
        const promptComment = `🤖 @${mergerUsername || "mentor"}: Please label this PR to award points to @${authorUsername}.`;
        await postGitHubPRComment(installationId, owner, repoName, prNumber, promptComment);
      }
    }

    if (notify) {
      await postDiscordAlert(
        `🏆 **Pull Request Merged (${difficulty})**\nTrack: ${repoDoc.track}\nPR: [#${prNumber}](${htmlUrl}) by @${authorUsername}\nAwarded: **+${pointsAwarded} points** to developer.${effortNote}`,
        "success"
      );
    }
  }

  // Save status to DB
  await PullRequest.findOneAndUpdate(
    { prId },
    {
      prNumber,
      repository: repoDoc._id,
      author: authorDoc._id,
      title,
      htmlUrl,
      state: "merged",
      difficultyLabel: difficulty,
      pointsAwarded: pointsAwarded,
      suspicious: isSuspicious,
      mergedAt: mergedAt ? new Date(mergedAt) : new Date(),
      ...(source ? { source } : {}),
      ...(source === "backfill" ? { backfilledAt: new Date() } : {}),
      $setOnInsert: { createdAt: createdAt ? new Date(createdAt) : new Date() },
    },
    { upsert: true }
  );

  return { pointsAwarded, isSuspicious, coAuthorPointsAwarded, difficulty };
}