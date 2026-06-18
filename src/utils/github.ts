import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

// Logs of simulated GitHub activities (e.g. comments written, reviews fetched) to render inside the preview control panel
export interface IGitHubSimLog {
  id: string;
  type: "comment" | "alert" | "api_call";
  target: string;
  payload: string;
  timestamp: Date;
}

export const githubSimLogs: IGitHubSimLog[] = [];

export function logGitHubAction(type: "comment" | "alert" | "api_call", target: string, payload: string) {
  githubSimLogs.unshift({
    id: `gh-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    target,
    payload,
    timestamp: new Date()
  });
}

// Global cache for octokit instances to avoid rebuilding
let githubAppInstance: App | null = null;

function getGitHubApp(): App | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKeyBase64) {
    return null;
  }

  if (!githubAppInstance) {
    try {
      // Decode private key from base64
      const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8");
      githubAppInstance = new App({
        appId: appId,
        privateKey: privateKey,
      });
      console.log("🤖 GitHub App Octokit instance initialized successfully.");
    } catch (err: any) {
      console.warn("⚠️ Failed to initialize standard GitHub App Octokit from credentials:", err.message);
      return null;
    }
  }

  return githubAppInstance;
}

/**
 * Returns an authenticated Octokit client for the given installation ID
 */
export async function getInstallationOctokit(installationId: string): Promise<Octokit | null> {
  const app = getGitHubApp();
  if (!app) {
    return null;
  }
  try {
    return (await app.getInstallationOctokit(parseInt(installationId))) as unknown as Octokit;
  } catch (err: any) {
    console.warn(`⚠️ Failed to authenticate Octokit for installation ID ${installationId}:`, err.message);
    return null;
  }
}

/**
 * Post a comment on a GitHub Pull Request (or issue)
 */
export async function postGitHubPRComment(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<boolean> {
  const msg = `Comment posted on ${owner}/${repo}#${prNumber}: "${body}"`;
  console.log(`🤖 GitHub Service: ${msg}`);
  logGitHubAction("comment", `${owner}/${repo}#${prNumber}`, body);

  const octokit = await getInstallationOctokit(installationId);
  if (!octokit) {
    console.log("ℹ️ Running in Sandbox mode. GitHub Comment has been saved to simulation logs.");
    return false;
  }

  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    return true;
  } catch (err: any) {
    console.warn(`❌ Failed to post actual GitHub comment:`, err.message);
    return false;
  }
}

/**
 * Retrieve changed file metadata to count line additions/modifications
 */
export async function getPullRequestFilesCount(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ additions: number; deletions: number; changedFiles: number }> {
  logGitHubAction("api_call", `${owner}/${repo}#${prNumber}`, "Fetch file metrics");

  const octokit = await getInstallationOctokit(installationId);
  if (!octokit) {
    // If running offline, we simulate high-fidelity counts from mocked webhook payloads
    console.log("ℹ️ Offline context: Webhook payload size metrics will represent the PR effort.");
    return { additions: 15, deletions: 2, changedFiles: 1 };
  }

  try {
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return {
      additions: data.additions || 0,
      deletions: data.deletions || 0,
      changedFiles: data.changed_files || 0,
    };
  } catch (err: any) {
    console.warn(`❌ Failed to fetch pull request metadata from GitHub:`, err.message);
    return { additions: 0, deletions: 0, changedFiles: 0 };
  }
}

/**
 * Retrieve commits inside a Pull Request to parse Co-Author metadata
 */
export async function getPullRequestCommits(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Array<{ message: string; authorEmail?: string; authorLogin?: string }>> {
  logGitHubAction("api_call", `${owner}/${repo}#${prNumber}`, "Fetch commit history");

  const octokit = await getInstallationOctokit(installationId);
  if (!octokit) {
    return [];
  }

  try {
    const { data } = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data.map(c => ({
      message: c.commit.message,
      authorEmail: c.commit.author?.email || undefined,
      authorLogin: c.author?.login || undefined
    }));
  } catch (err: any) {
    console.warn(`❌ Failed to retrieve commits for PR:`, err.message);
    return [];
  }
}

/**
 * Trigger alerts to Discord when actions (good or bad) happen
 */
export async function postDiscordAlert(content: string, type: "success" | "warning" | "info" = "info"): Promise<void> {
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  console.log(`📢 [Discord Alert - ${type.toUpperCase()}]: ${content}`);
  logGitHubAction("alert", "Discord Channel", content);

  if (!discordUrl) {
    console.log("ℹ️ Discord configuration not detected. Alert has been saved to simulation log.");
    return;
  }

  try {
    const colorMap = {
      success: 3066993, // Green
      warning: 15158332, // Red/Orange
      info: 3447003, // Blue
    };

    const embed = {
      title: type === "warning" ? "️⚠️ Security Constraint Triggered" : "🏆 Fellowship Update",
      description: content,
      color: colorMap[type],
      timestamp: new Date().toISOString(),
      footer: {
        text: "IEEEsoc-Bot Engine Alert",
      },
    };

    await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
  } catch (err: any) {
    console.error("❌ Failed to forward alert to Discord webhook:", err.message);
  }
}
