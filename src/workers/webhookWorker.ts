import User from "../models/User";
import Repository from "../models/Repository";
import PullRequest, { IReview } from "../models/PullRequest";
import { postGitHubPRComment, getPullRequestFilesCount, getPullRequestCommits, postDiscordAlert } from "../utils/github";
import { Worker as BullWorker } from "bullmq";

/**
 * Main webhook worker entry-point. Resolves state and updates database.
 */
export async function processWebhookJob(payload: any) {
  const event = payload._event; // Custom field passed by webhook server, e.g. "pull_request" or "pull_request_review"
  const action = payload.action;

  console.log(`🌀 [Worker Input] Processing webhook event: "${event}.${action}"`);

  if (event === "pull_request") {
    await handlePullRequestEvent(action, payload);
  } else if (event === "pull_request_review") {
    await handlePullRequestReviewEvent(action, payload);
  } else {
    console.log(`ℹ️ Unhandled payload type: ${event}`);
  }
}

/**
 * A. Pull Request Events
 */
async function handlePullRequestEvent(action: string, payload: any) {
  const prPayload = payload.pull_request;
  if (!prPayload) return;

  const repoPayload = payload.repository;
  const senderLogin = payload.sender?.login || "unknown-user";

  const owner = repoPayload.owner.login;
  const repoName = repoPayload.name;
  const installationId = payload.installation?.id ? String(payload.installation.id) : "simulated";

  // Look up Repository in DB
  let repoDoc = await Repository.findOne({ repoId: String(repoPayload.id) });
  if (!repoDoc) {
    // Lazy creation to keep DB populated and auto-resilient
    console.log(`📁 Lazy loading repository in DB: ${repoPayload.full_name}`);
    repoDoc = await Repository.create({
      repoId: String(repoPayload.id),
      name: repoName,
      fullName: repoPayload.full_name,
      owner: owner,
      htmlUrl: repoPayload.html_url,
      track: inferTrackFromName(repoName),
      installationId: installationId,
    });
  }

  // Look up or Upsert Author in DB
  let authorDoc = await User.findOne({ username: prPayload.user.login });
  if (!authorDoc) {
    console.log(`👤 Lazy loading Fellow/User in DB: ${prPayload.user.login}`);
    authorDoc = await User.create({
      githubId: String(prPayload.user.id),
      username: prPayload.user.login,
      name: prPayload.user.login,
      email: `${prPayload.user.login}@github.com`,
      avatarUrl: prPayload.user.avatar_url,
      role: "fellow",
      track: repoDoc.track,
      assignedRepo: repoDoc._id,
    });
  }

  // Find or parse labels of the PR
  const labels: any[] = prPayload.labels || [];
  const activeDifficultyLabel = getDifficultyFromLabels(labels);

  // 1. PR Opened / Reopened
  if (action === "opened" || action === "reopened") {
    // Description matching verification
    const prBody = prPayload.body || "";
    const wordCount = prBody.trim().split(/\s+/).filter(Boolean).length;
    let autoComment = "";

    if (wordCount < 10) {
      autoComment = `🤖 @${authorDoc.username}: Thank you for opening this PR! Please describe your implementation with more detail (currently under 10 words) to help your mentor review it faster.`;
      await postGitHubPRComment(installationId, owner, repoName, prPayload.number, autoComment);
    }

    await PullRequest.findOneAndUpdate(
      { prId: String(prPayload.id) },
      {
        prNumber: prPayload.number,
        repository: repoDoc._id,
        author: authorDoc._id,
        title: prPayload.title,
        htmlUrl: prPayload.html_url,
        state: "open",
        isDraft: !!prPayload.draft,
        difficultyLabel: activeDifficultyLabel,
        createdAt: new Date(prPayload.created_at),
      },
      { upsert: true, new: true }
    );

    await postDiscordAlert(
      `🆕 **Pull Request Opened**\n**Track:** ${repoDoc.track}\nPR: [#${prPayload.number}](${prPayload.html_url}) by @${authorDoc.username}\nTitle: *${prPayload.title}*${autoComment ? "\n📝 *Note: Flaggd for brief summary description*" : ""}`,
      "info"
    );
  }

  // 2. PR Edited
  else if (action === "edited") {
    await PullRequest.findOneAndUpdate(
      { prId: String(prPayload.id) },
      {
        title: prPayload.title,
        isDraft: !!prPayload.draft,
        difficultyLabel: activeDifficultyLabel,
      }
    );
    console.log(`📝 Updated edited state for PR #${prPayload.number}`);
  }

  // 3. PR Closed (Unmerged)
  else if (action === "closed" && !prPayload.merged) {
    await PullRequest.findOneAndUpdate(
      { prId: String(prPayload.id) },
      { state: "closed", closedAt: new Date(prPayload.closed_at) }
    );
    await postDiscordAlert(
      `❌ **Pull Request Closed (Unmerged)**\nPR: [#${prPayload.number}](${prPayload.html_url}) by @${authorDoc.username}`,
      "info"
    );
  }

  // 4. PR Merged
  else if (action === "closed" && prPayload.merged) {
    const existingPr = await PullRequest.findOne({ prId: String(prPayload.id) });
    if (existingPr && existingPr.state === "merged") {
      console.log(`⚠️ Prevent double counting: PR #${prPayload.number} was already marked as merged.`);
      return;
    }

    console.log(`🎉 [PR Merged] Awarding points for Pull Request #${prPayload.number}`);

    let isSuspicious = false;
    let pointsAwarded = 0;
    const mergerUsername = prPayload.merged_by?.login || senderLogin;

    // A. Self-Merge Check
    if (mergerUsername === authorDoc.username) {
      isSuspicious = true;
      pointsAwarded = 0;

      const warningComment = `⚠️ **Anti-Cheat Warning** @${authorDoc.username}: You self-merged your own Pull Request without an independent mentor approval review. 0 points have been awarded and this event has been flagged.`;
      await postGitHubPRComment(installationId, owner, repoName, prPayload.number, warningComment);
      await postDiscordAlert(
        `🚨 **Suspicious Activity Flagged**\n@${authorDoc.username} self-merged their own Pull Request (**PR #${prPayload.number}**). Awarded 0 points.`,
        "warning"
      );
    } else {
      // Calculate normal award points based on label
      const basePoints = getPointsForLabel(activeDifficultyLabel);
      pointsAwarded = basePoints;

      // B. Low effort check (Medium or Hard difficulty but < 5 changes lines)
      const lineChanges = await getPullRequestFilesCount(installationId, owner, repoName, prPayload.number);
      const totalDiffCount = lineChanges.additions + lineChanges.deletions;
      
      let effortNote = "";
      if ((activeDifficultyLabel === "soc-medium" || activeDifficultyLabel === "soc-hard") && totalDiffCount < 5) {
        effortNote = `\n⚠️ *Caution: Labeled ${activeDifficultyLabel} but diff has only ${totalDiffCount} line changes.*`;
        // Do not block points but flag inside database for audit
        isSuspicious = true; // flagged for investigation
      }

      // C. Parse Commits for Co-Authors
      const commits = await getPullRequestCommits(installationId, owner, repoName, prPayload.number);
      const coAuthors: string[] = [];
      const coAuthorDocs: any[] = [];

      for (const commit of commits) {
        const matches = [...commit.message.matchAll(/Co-authored-by:\s*([^\s<]+)\s*<([^>]+)>/gi)];
        for (const match of matches) {
          const caUsername = match[1];
          const caEmail = match[2];
          
          if (caUsername !== authorDoc.username && !coAuthors.includes(caUsername)) {
            // Find registered co-author
            const coAuthorUser = await User.findOne({
              $or: [{ username: caUsername }, { email: caEmail }],
              role: "fellow"
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
        for (const caDoc of coAuthorAuthorDocs(coAuthorDocs)) {
          await User.updateOne({ _id: caDoc._id }, { $inc: { score: coAuthorPoints } });
          const coAuthorPrComment = `🤖 @${caDoc.username} awarded **+${coAuthorPoints} points** (50% co-author split) for contributing to PR #${prPayload.number}!`;
          await postGitHubPRComment(installationId, owner, repoName, prPayload.number, coAuthorPrComment);
        }

        // Post success comment on PR
        const successComment = `🤖 @${authorDoc.username} awarded **+${pointsAwarded} points** for completing a \`${activeDifficultyLabel}\` contribution! 🏆${coAuthors.length > 0 ? ` Co-authors awarded points: ${coAuthors.map(c => "@" + c).join(", ")}.` : ""}`;
        await postGitHubPRComment(installationId, owner, repoName, prPayload.number, successComment);
      } else if (activeDifficultyLabel === "unlabeled") {
        // Lacking tags
        const promptComment = `🤖 @${mergerUsername}: Please label this PR to award points to @${authorDoc.username}.`;
        await postGitHubPRComment(installationId, owner, repoName, prPayload.number, promptComment);
      }

      await postDiscordAlert(
        `🏆 **Pull Request Merged (${activeDifficultyLabel})**\nTrack: ${repoDoc.track}\nPR: [#${prPayload.number}](${prPayload.html_url}) by @${authorDoc.username}\nAwarded: **+${pointsAwarded} points** to developer.${effortNote}`,
        "success"
      );
    }

    // Save status to DB
    await PullRequest.findOneAndUpdate(
      { prId: String(prPayload.id) },
      {
        prNumber: prPayload.number,
        repository: repoDoc._id,
        author: authorDoc._id,
        title: prPayload.title,
        htmlUrl: prPayload.html_url,
        state: "merged",
        difficultyLabel: activeDifficultyLabel,
        pointsAwarded: pointsAwarded,
        suspicious: isSuspicious,
        mergedAt: new Date(prPayload.merged_at || Date.now()),
      },
      { upsert: true }
    );
  }

  // 5. PR Labeled or Unlabeled (Post-Merge Changes)
  else if (action === "labeled" || action === "unlabeled") {
    const existingPr = await PullRequest.findOne({ prId: String(prPayload.id) }).populate("author");
    if (!existingPr || existingPr.state !== "merged") {
      // Points adjustments only happen for already merged PRs
      return;
    }

    console.log(`🏷️ Labels changed post-merge on PR #${prPayload.number}`);

    // If the Fellow (author) changed the label, block and warning!
    if (senderLogin === (existingPr.author as any).username) {
      console.warn(`🛑 Cheat Attempt: Merged PR author @${senderLogin} changed label. Reverting/ignoring points calculation.`);
      const warningComment = `🛑 **Anti-Cheat Alert** @${senderLogin}: Fellows are strictly forbidden from modifying category labels on merged PRs. This point change has been blocked and logged.`;
      await postGitHubPRComment(installationId, owner, repoName, prPayload.number, warningComment);
      return;
    }

    // Lookup who executed this- we determine if they are a mentor/admin
    const triggerUser = await User.findOne({ username: senderLogin });
    if (!triggerUser || (triggerUser.role !== "mentor" && triggerUser.role !== "admin")) {
      console.warn(`🛑 Unprivileged label change by ${senderLogin}. Points won't be adjusted.`);
      return;
    }

    // Compute updated points scale
    const oldPoints = existingPr.pointsAwarded || 0;
    const newDifficulty = getDifficultyFromLabels(labels);
    const newPoints = getPointsForLabel(newDifficulty);
    const delta = newPoints - oldPoints;

    if (delta !== 0) {
      console.log(`⚖️ Point Delta Identified: ${delta} (${oldPoints} -> ${newPoints}). Adjusting score for @${(existingPr.author as any).username}`);
      
      // Update Author User score
      await User.updateOne({ _id: (existingPr.author as any)._id }, { $inc: { score: delta } });

      // Update PR state
      existingPr.pointsAwarded = newPoints;
      existingPr.difficultyLabel = newDifficulty;
      await existingPr.save();

      const adjustmentsComment = `🤖 **Contribution Scale Adjusted**: @${triggerUser.username} updated the difficulty label to \`${newDifficulty}\`. Author @${(existingPr.author as any).username}'s points adjusted by **${delta >= 0 ? "+" : ""}${delta}** (Current total PR score: **${newPoints}**).`;
      await postGitHubPRComment(installationId, owner, repoName, prPayload.number, adjustmentsComment);
      await postDiscordAlert(
        `🛡️ **Points Adjusted Post-Merge**\nPR: [#${prPayload.number}](${existingPr.htmlUrl})\nBy Admin/Mentor: @${triggerUser.username}\nDelta: **${delta >= 0 ? "+" : ""}${delta} points** to @${(existingPr.author as any).username} (New target: ${newDifficulty})`,
        "info"
      );
    }
  }
}

/**
 * Filter list of co-author documents
 */
function coAuthorAuthorDocs(docs: any[]): any[] {
  return docs;
}

/**
 * B. Pull Request Review Events
 */
async function handlePullRequestReviewEvent(action: string, payload: any) {
  if (action !== "submitted") return;

  const reviewPayload = payload.review;
  const prPayload = payload.pull_request;
  const repoPayload = payload.repository;

  if (!reviewPayload || !prPayload || !repoPayload) return;

  const reviewerLogin = reviewPayload.user.login;
  const prId = String(prPayload.id);

  console.log(`🔍 [Review Submitted] Reviewer @${reviewerLogin} on PR #${prPayload.number}`);

  // Fetch reviewer user, check if they are a Mentor
  let reviewerDoc = await User.findOne({ username: reviewerLogin });
  if (!reviewerDoc) {
    // Lazy create Reviewer
    reviewerDoc = await User.create({
      githubId: String(reviewPayload.user.id),
      username: reviewerLogin,
      name: reviewerLogin,
      email: `${reviewerLogin}@github.com`,
      avatarUrl: reviewPayload.user.avatar_url,
      role: "mentor", // default to mentor if reviewing
      mentorScore: 0,
    });
  }

  // Find corresponding Pull Request in DB
  let prDoc = await PullRequest.findOne({ prId }).populate("author");
  if (!prDoc) {
    // Lazy create pull request in DB to maintain integrity
    console.log(`🔌 Lazy loading Pull Request in DB: PR #${prPayload.number}`);
    
    let repoDoc = await Repository.findOne({ repoId: String(repoPayload.id) });
    if (!repoDoc) {
      repoDoc = await Repository.create({
        repoId: String(repoPayload.id),
        name: repoPayload.name,
        fullName: repoPayload.full_name,
        owner: repoPayload.owner.login,
        htmlUrl: repoPayload.html_url,
        track: inferTrackFromName(repoPayload.name),
        installationId: payload.installation?.id ? String(payload.installation.id) : "simulated",
      });
    }

    let authorDoc = await User.findOne({ username: prPayload.user.login });
    if (!authorDoc) {
      authorDoc = await User.create({
        githubId: String(prPayload.user.id),
        username: prPayload.user.login,
        name: prPayload.user.login,
        email: `${prPayload.user.login}@github.com`,
        avatarUrl: prPayload.user.avatar_url,
        role: "fellow",
        track: repoDoc.track,
      });
    }

    const labels: any[] = prPayload.labels || [];
    const activeDifficultyLabel = getDifficultyFromLabels(labels);

    prDoc = await PullRequest.create({
      prId: prId,
      prNumber: prPayload.number,
      repository: repoDoc._id,
      author: authorDoc._id,
      title: prPayload.title,
      htmlUrl: prPayload.html_url,
      state: prPayload.state,
      isDraft: !!prPayload.draft,
      difficultyLabel: activeDifficultyLabel,
      createdAt: new Date(prPayload.created_at),
      reviews: [],
    });
  }

  // Check if this reviewer already submitted a review inside this PR (prevent turnaround double awards)
  const isFirstReviewByReviewer = !prDoc.reviews.some((r: any) => String(r.reviewer) === String(reviewerDoc._id));
  const isFirstReviewOverall = prDoc.reviews.length === 0;

  // Record review in PR Doc state
  const reviewState = reviewPayload.state ? reviewPayload.state.toUpperCase() : "COMMENTED";
  const submittedAt = new Date(reviewPayload.submittedAt || reviewPayload.submitted_at || Date.now());

  const newReview: IReview = {
    reviewer: reviewerDoc._id,
    state: reviewState,
    submittedAt: submittedAt,
  };

  prDoc.reviews.push(newReview);

  // Turnaround calculations apply to first overall review submission on non-draft PRs
  if (isFirstReviewOverall && !prDoc.isDraft) {
    const readyForReviewTime = prDoc.createdAt; // baseline
    const diffMs = submittedAt.getTime() - readyForReviewTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const turnaroundSeconds = Math.max(0, Math.floor(diffMs / 1000));

    prDoc.turnaroundTimeSeconds = turnaroundSeconds;

    // Only award points to Mentors (role: 'mentor' or 'admin')
    if (reviewerDoc.role === "mentor" || reviewerDoc.role === "admin") {
      let earnedPoints = 0;
      if (diffHours <= 24) {
        earnedPoints = 15;
      } else if (diffHours <= 48) {
        earnedPoints = 5;
      }

      if (earnedPoints > 0) {
        reviewerDoc.mentorScore = (reviewerDoc.mentorScore || 0) + earnedPoints;
        await reviewerDoc.save();
        console.log(`⚡ Mentor @${reviewerDoc.username} earned +${earnedPoints} review points (Turnaround: ${diffHours.toFixed(2)}h)`);
        
        await postDiscordAlert(
          `⚡ **Mentor Review Award**\nMentor: @${reviewerDoc.username}\nPR Reviewed: [#${prPayload.number}](${prPayload.html_url}) by @${(prDoc.author as any).username}\nTurnaround speed: **${diffHours.toFixed(1)} hrs**\nPoints Awarded: **+${earnedPoints} mentor points**`,
          "info"
        );
      }
    }
  }

  await prDoc.save();
}

/**
 * UTILS & HELPERS
 */
function inferTrackFromName(repoName: string): "AI" | "Full-Stack" | "DevOps" | "Security" | "Frontier" {
  const norm = repoName.toLowerCase();
  if (norm.includes("ai")) return "AI";
  if (norm.includes("web") || norm.includes("stack") || norm.includes("backend") || norm.includes("frontend")) return "Full-Stack";
  if (norm.includes("devops") || norm.includes("infra") || norm.includes("ci")) return "DevOps";
  if (norm.includes("sec") || norm.includes("cyber") || norm.includes("scanner")) return "Security";
  return "Frontier";
}

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

/**
 * Live BullMQ background worker mounting
 */
export function startRealBullMQWorker(redisClient: any) {
  console.log("⚙️ Launching live BullMQ Webhook Worker thread...");
  const worker = new BullWorker(
    "webhook-queue",
    async (job) => {
      console.log(`📦 [BullMQ Background Processing] Polled job details for execution: ID: ${job.id}`);
      await processWebhookJob(job.data);
    },
    { connection: redisClient }
  );

  worker.on("active", (job) => {
    console.log(`🏃‍♂️ Job ${job.id} is active.`);
  });

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} has completed.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err);
  });
}
