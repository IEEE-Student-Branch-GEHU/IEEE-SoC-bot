import React, { useState, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Settings,
  RefreshCw,
  Send,
  Terminal,
  ShieldAlert,
  Users,
  FolderGit2,
  Calendar,
  TrendingUp,
  Activity,
  Database,
  Lock,
  PlusCircle,
  Clock,
  Trash2,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface IFellowRanking {
  rank: number;
  _id: string;
  githubId: string;
  username: string;
  name: string;
  track: string;
  score: number;
  avatarUrl?: string;
  mergedPRCount: number;
}

interface IRepositorySim {
  _id: string;
  repoId: string;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  track: string;
  installationId: string;
}

interface IJobLog {
  id: string;
  name: string;
  data: any;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  timestamp: string;
}

interface IGitHubSimLog {
  id: string;
  type: string;
  target: string;
  payload: string;
  timestamp: string;
}

export default function App() {
  // Navigation & filtering states
  const [activeTrackFilter, setActiveTrackFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeLogTab, setActiveLogTab] = useState<"bullmq" | "bot_ops">("bullmq");

  // Leaderboard data state
  const [rankings, setRankings] = useState<IFellowRanking[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [generalStats, setGeneralStats] = useState({
    totalPRs: 0,
    mergedPRs: 0,
    totalFellows: 0,
    suspiciousCount: 0,
    totalPoints: 0,
  });

  // Repositories state (for simulator dropdowns & controls)
  const [repositories, setRepositories] = useState<IRepositorySim[]>([]);

  // Simulation, Background queue, Activity states
  const [jobLogs, setJobLogs] = useState<IJobLog[]>([]);
  const [githubActionLogs, setGithubActionLogs] = useState<IGitHubSimLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Admin JWT Security States
  const [jwtToken, setJwtToken] = useState<string>("");
  const [adminUsername, setAdminUsername] = useState<string>("admin");
  const [adminPassword, setAdminPassword] = useState<string>("ieeesoc2026");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string>("");
  const [resyncLogs, setResyncLogs] = useState<string[]>([]);
  const [resyncSummary, setResyncSummary] = useState<any>(null);

  // Webhook Event Simulation states
  const [simOwner, setSimOwner] = useState<string>("ieee-soc");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedFellowUsername, setSelectedFellowUsername] = useState<string>("");
  const [simPrNumber, setSimPrNumber] = useState<number>(101);
  const [simPrTitle, setSimPrTitle] = useState<string>("feat: Add resilient Redis/BullMQ fail-safe retry mechanism");
  const [simPrBody, setSimPrBody] = useState<string>("This pull request implements the requested BullMQ asynchronous pipeline, verifying GitHub signatures with timingSafeEqual and deduplicating events with 24h TTL headers.");
  const [simEventPreset, setSimEventPreset] = useState<string>("opened-easy");

  // Auxiliary Quick-Add Entry Forms states
  const [newFellowName, setNewFellowName] = useState<string>("");
  const [newFellowGithub, setNewFellowGithub] = useState<string>("");
  const [newFellowTrack, setNewFellowTrack] = useState<string>("AI");
  const [newFellowEmail, setNewFellowEmail] = useState<string>("");
  const [formSuccessMessage, setFormSuccessMessage] = useState<string>("");

  // Retrieve essential statistics, rankings and database configuration
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch rankings based on track filter
      const filterQuery = activeTrackFilter ? `?track=${activeTrackFilter}` : "";
      const rankRes = await fetch(`/api/leaderboard${filterQuery}`);
      const rankData = await rankRes.json();
      if (rankData.success) {
        setRankings(rankData.data);
        if (rankData.pagination) setPagination(rankData.pagination);
      }

      // 2. Fetch general stats
      const statsRes = await fetch("/api/stats");
      const statsData = await statsRes.json();
      if (statsData.success) {
        setGeneralStats(statsData.stats);
      }

      // 3. Fetch background BullMQ queue job simulation logs
      const jobsRes = await fetch("/api/job-logs");
      const jobsData = await jobsRes.json();
      if (jobsData.success) {
        setJobLogs(jobsData.logs);
      }

      // 4. Fetch GitHub Sim Logs (comments written etc)
      const logsRes = await fetch("/api/github-logs");
      const logsData = await logsRes.json();
      if (logsData.success) {
        setGithubActionLogs(logsData.logs);
      }
    } catch (err) {
      console.error("Error pulling live stats:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Populate form dropdowns on startup
  const fetchMockMeta = async () => {
    try {
      // Look up all fellows in raw DB rankings to fill the simulators selection dropdowns
      const allFellowsRes = await fetch("/api/leaderboard");
      const fellowsData = await allFellowsRes.json();
      if (fellowsData.success && fellowsData.data.length > 0) {
        setSelectedFellowUsername(fellowsData.data[0].username);
      }

      // Hardcoded list representing our initial list of tracked repos (synced with config db mock)
      const mockRepositories = [
        { _id: "1", repoId: "900001", name: "ieeesoc-ai-core", fullName: "ieee-soc/ieeesoc-ai-core", owner: "ieee-soc", htmlUrl: "https://github.com/ieee-soc/ieeesoc-ai-core", track: "AI", installationId: "12345678" },
        { _id: "2", repoId: "900002", name: "ieeesoc-full-stack-web", fullName: "ieee-soc/ieeesoc-full-stack-web", owner: "ieee-soc", htmlUrl: "https://github.com/ieee-soc/ieeesoc-full-stack-web", track: "Full-Stack", installationId: "12345678" },
        { _id: "3", repoId: "900003", name: "ieeesoc-devops-automation", fullName: "ieee-soc/ieeesoc-devops-automation", owner: "ieee-soc", htmlUrl: "https://github.com/ieee-soc/ieeesoc-devops-automation", track: "DevOps", installationId: "12345678" },
        { _id: "4", repoId: "900004", name: "ieeesoc-security-scanner", fullName: "ieee-soc/ieeesoc-security-scanner", owner: "ieee-soc", htmlUrl: "https://github.com/ieee-soc/ieeesoc-security-scanner", track: "Security", installationId: "12345678" },
        { _id: "5", repoId: "900005", name: "ieeesoc-frontier-quantum", fullName: "ieee-soc/ieeesoc-frontier-quantum", owner: "ieee-soc", htmlUrl: "https://github.com/ieee-soc/ieeesoc-frontier-quantum", track: "Frontier", installationId: "12345678" }
      ];
      setRepositories(mockRepositories);
      setSelectedRepoId("900002"); // default selection: full-stack repo
    } catch (err) {
      console.error("Error setting dropdown configurations:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMockMeta();

    // Setup periodic logging refresh for simulated background threading updates
    const logInterval = setInterval(() => {
      fetchData();
    }, 2500);

    return () => clearInterval(logInterval);
  }, [activeTrackFilter]);

  // Execute JWT admin login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setJwtToken(data.token);
        setIsAdminLoggedIn(true);
        setFormSuccessMessage("Authorized successfully. Administrative session active.");
        setTimeout(() => setFormSuccessMessage(""), 4000);
      } else {
        setAdminError(data.error || "Authentication failed. Double check credentials.");
      }
    } catch (err: any) {
      setAdminError("Unable to reach server authentication gateway.");
    }
  };

  // Trigger historical PR audit synchronization for a repository
  const handleRepositoryResync = async (repoId: string, repoName: string) => {
    if (!jwtToken) {
      setAdminError("Please log in as an administrator first to perform resync actions.");
      return;
    }
    setIsLoading(true);
    setResyncLogs([]);
    setResyncSummary(null);

    try {
      const res = await fetch(`/api/admin/repositories/${repoId}/resync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResyncSummary(data.summary);
        setResyncLogs(data.details || []);
        fetchData();
      } else {
        setResyncLogs([`❌ Sync error: ${data.error || "Failed execution"}`]);
      }
    } catch (err: any) {
      setResyncLogs([`❌ Connection error: ${err.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Form submitting: Create active Fellow in backend
  const handleQuickAddFellow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFellowGithub || !newFellowName) {
      alert("Please provide the complete candidate Github username & proper Display name!");
      return;
    }

    // Since we'll create the user model dynamically, we can trigger a mock PR or send an event,
    // but we can also simulate a direct webhook event with the user being lazy loaded on the fly!
    // Or, we can let user know they can just type ANY username in the Webhook Simulator and the
    // bot will auto-create (lazy-load) them. That's a highly robust built-in API feature:
    // "Let's find or lazy load User/Fellow on first PR submission event!"
    // So writing a quick message is beautiful:
    setFormSuccessMessage(`Success! Fellow candidate @${newFellowGithub} has been set. Simply trigger a Simulated PR for @${newFellowGithub} below, and our lazy loading engine will provision them on the fly!`);
    setSelectedFellowUsername(newFellowGithub);
    
    // reset form
    setNewFellowName("");
    setNewFellowGithub("");
  };

  // Helper: Trigger the webhook payload poster simulating real GitHub hooks securely
  const triggerSimulatedWebhook = async () => {
    setIsLoading(true);
    const targetRepo = repositories.find((r) => r.repoId === selectedRepoId);
    if (!targetRepo) {
      alert("Invalid database repo selection.");
      setIsLoading(false);
      return;
    }

    const deliveryId = `github-delivery-uuid-${Date.now()}-${Math.floor(Math.random() * 9000)}`;
    const prId = `gh-pr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const eventHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-GitHub-Delivery": deliveryId,
    };

    let postUrl = "/api/bot/webhook";
    let bodyPayload: any = {};

    // 1. Build Payload and Headers based on Event Presets
    if (simEventPreset.startsWith("opened-")) {
      eventHeaders["X-GitHub-Event"] = "pull_request";
      const isDraft = simEventPreset === "opened-draft";
      const labelName = simEventPreset === "opened-easy" ? "soc-easy" : simEventPreset === "opened-medium" ? "soc-medium" : "soc-hard";

      bodyPayload = {
        action: "opened",
        installation: { id: 12345678 },
        repository: {
          id: parseInt(targetRepo.repoId),
          name: targetRepo.name,
          full_name: targetRepo.fullName,
          owner: { login: targetRepo.owner },
          html_url: targetRepo.htmlUrl,
        },
        sender: { login: selectedFellowUsername },
        pull_request: {
          id: parseInt(prId.replace(/\D/g, "").slice(0, 8)) || Date.now(),
          number: simPrNumber,
          title: simPrTitle,
          body: simPrBody,
          state: "open",
          draft: isDraft,
          user: {
            id: 700000 + Math.floor(Math.random() * 1000),
            login: selectedFellowUsername,
            avatar_url: `https://avatars.githubusercontent.com/${selectedFellowUsername}`,
          },
          labels: isDraft ? [] : [{ name: labelName }],
          html_url: `${targetRepo.htmlUrl}/pull/${simPrNumber}`,
          created_at: new Date().toISOString(),
        },
      };
    } 
    // PRESET: Valid PR Merge (Fellow + separate approved reviews)
    else if (simEventPreset.startsWith("merged-")) {
      eventHeaders["X-GitHub-Event"] = "pull_request";
      const difficulty = simEventPreset === "merged-easy" ? "soc-easy" : simEventPreset === "merged-medium" ? "soc-medium" : "soc-hard";

      bodyPayload = {
        action: "closed", // GitHub PR Webhooks trigger closed action with merged: true/false
        installation: { id: 12345678 },
        repository: {
          id: parseInt(targetRepo.repoId),
          name: targetRepo.name,
          full_name: targetRepo.fullName,
          owner: { login: targetRepo.owner },
          html_url: targetRepo.htmlUrl,
        },
        sender: { login: "mentor-sarah" }, // Separate mentor closed it
        pull_request: {
          id: parseInt(prId.replace(/\D/g, "").slice(0, 8)) || Date.now(),
          number: simPrNumber,
          title: simPrTitle,
          body: simPrBody,
          state: "closed",
          merged: true, // Crucial
          merged_by: { login: "mentor-sarah" }, // Approved mentor merged it
          user: {
            id: 700000 + Math.floor(Math.random() * 1000),
            login: selectedFellowUsername,
            avatar_url: `https://avatars.githubusercontent.com/${selectedFellowUsername}`,
          },
          labels: [{ name: difficulty }],
          html_url: `${targetRepo.htmlUrl}/pull/${simPrNumber}`,
          created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          merged_at: new Date().toISOString(),
        },
      };
    } 
    // PRESET: Cheat self-merge
    else if (simEventPreset === "cheat-selfmerge") {
      eventHeaders["X-GitHub-Event"] = "pull_request";
      bodyPayload = {
        action: "closed",
        installation: { id: 12345678 },
        repository: {
          id: parseInt(targetRepo.repoId),
          name: targetRepo.name,
          full_name: targetRepo.fullName,
          owner: { login: targetRepo.owner },
          html_url: targetRepo.htmlUrl,
        },
        sender: { login: selectedFellowUsername }, // Same User
        pull_request: {
          id: parseInt(prId.replace(/\D/g, "").slice(0, 8)) || Date.now(),
          number: simPrNumber,
          title: "🚨 Bypassing review constraints: merge directly onto master branch",
          body: "Direct merges without approval bypass.",
          state: "closed",
          merged: true,
          merged_by: { login: selectedFellowUsername }, // AUTHOR MERGED THEMSELF!
          user: {
            id: 700000 + Math.floor(Math.random() * 1000),
            login: selectedFellowUsername,
            avatar_url: `https://avatars.githubusercontent.com/${selectedFellowUsername}`,
          },
          labels: [{ name: "soc-hard" }],
          html_url: `${targetRepo.htmlUrl}/pull/${simPrNumber}`,
          created_at: new Date().toISOString(),
          merged_at: new Date().toISOString(),
        },
      };
    } 
    // PRESET: Post merge label tampered by fellow (Cheating attempt)
    else if (simEventPreset === "tamper-label-fellow") {
      eventHeaders["X-GitHub-Event"] = "pull_request";
      bodyPayload = {
        action: "labeled", // label changed post merge
        sender: { login: selectedFellowUsername }, // Fellow author doing the change!
        installation: { id: 12345678 },
        repository: {
          id: parseInt(targetRepo.repoId),
          name: targetRepo.name,
          full_name: targetRepo.fullName,
          owner: { login: targetRepo.owner },
          html_url: targetRepo.htmlUrl,
        },
        pull_request: {
          id: 11001, // Targeting pre-seeded historic full-stack PR 42 (alex-dev is author)
          number: 42,
          state: "closed",
          merged: true,
          user: {
            id: 700001,
            login: "alex-dev", // Owner of targeted PR
          },
          // Attempting to inject high point 'soc-hard' label
          labels: [{ name: "soc-hard" }, { name: "soc-medium" }],
        }
      };
    }
    // PRESET: Post merge label modified by mentor (Valid adjustments)
    else if (simEventPreset === "adjust-label-mentor") {
      eventHeaders["X-GitHub-Event"] = "pull_request";
      bodyPayload = {
        action: "labeled",
        sender: { login: "mentor-sarah" }, // Mentor is modifying the label!
        installation: { id: 12345678 },
        repository: {
          id: parseInt(targetRepo.repoId),
          name: targetRepo.name,
          full_name: targetRepo.fullName,
          owner: { login: targetRepo.owner },
          html_url: targetRepo.htmlUrl,
        },
        pull_request: {
          id: 11001, // Targets seeded PR #42 (currently soc-hard, let's re-classify to soc-medium)
          number: 42,
          state: "closed",
          merged: true,
          user: {
            id: 700001,
            login: "alex-dev",
          },
          labels: [{ name: "soc-medium" }], // Adjusting down to medium
        }
      };
    } 
    // PRESET: Fast Mentor Review within 2 hours (+15 points)
    else if (simEventPreset === "mentor-review-fast") {
      eventHeaders["X-GitHub-Event"] = "pull_request_review";
      bodyPayload = {
        action: "submitted",
        sender: { login: "mentor-sarah" },
        installation: { id: 12345678 },
        repository: {
          id: parseInt(targetRepo.repoId),
          name: targetRepo.name,
          full_name: targetRepo.fullName,
          owner: { login: targetRepo.owner },
          html_url: targetRepo.htmlUrl,
        },
        pull_request: {
          id: 11001, // historic PR
          number: 42,
          state: "open",
          draft: false,
          created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
          user: {
            id: 700001,
            login: "alex-dev",
          }
        },
        review: {
          id: 44001,
          state: "approved",
          submitted_at: new Date().toISOString(), // submitted just now
          user: {
            id: 800001,
            login: "mentor-sarah",
          }
        }
      };
    }

    try {
      // Direct API fetch matching exact GitHub App callback webhook router
      const response = await fetch(postUrl, {
        method: "POST",
        headers: eventHeaders,
        body: JSON.stringify(bodyPayload),
      });

      const responseData = await response.json();
      if (response.ok) {
        setFormSuccessMessage(`🚀 Hook fired! DeliveryID: ${deliveryId}. Webhook server accepted request (Status ${response.status} -> Job ID: ${responseData.jobId}). Check the BullMQ logs and Rankings to see automated calculations execute in real-time!`);
        setTimeout(() => setFormSuccessMessage(""), 12000);
        setSimPrNumber((prev) => prev + 1); // increment pr number for subsequent testing
        fetchData();
      } else {
        alert(`Failed to trigger: ${responseData.error || "Unknown server response error."}`);
      }
    } catch (err: any) {
      alert(`Webhook simulated post failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear log states
  const handleClearLogs = async () => {
    try {
      await fetch("/api/admin/clear-logs", { method: "POST" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRankings = rankings.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.username.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      item.track.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-white">
      {/* Decorative ambient background accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-10 w-[500px] h-[550px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Header bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-xl border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)] animate-pulse">
              <Cpu className="w-6 h-6" id="app-logo" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-bold text-lg tracking-tight text-white uppercase">
                  IEEESoc Bot Control Panel
                </h1>
                <span className="bg-indigo-500/20 text-indigo-300 font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-indigo-400/20">
                  Automation Hub v2.1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contribution Tracking, Anti-Cheat Verification, Mentor SLA Auditing & Score Allocation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* System Status Indicators */}
            <div className="flex items-center gap-2 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 text-xs font-mono">DB:</span>
              <span className="text-emerald-400 text-xs font-bold font-mono">InMemory replica (active)</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300 text-xs font-mono">Queue:</span>
              <span className="text-cyan-400 text-xs font-bold font-mono">BullMQ-simulated Thread Pool</span>
            </div>

            <button
              onClick={fetchData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white px-3.5 py-2 rounded-lg transition-all border border-slate-700/80 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main dashboard body */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Fellows</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold font-mono text-white leading-none">
                {generalStats.totalFellows}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Active fellows enrolled</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">PRs Ingested</span>
              <FolderGit2 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold font-mono text-white leading-none">
                {generalStats.totalPRs}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Total pull-request actions</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">PRs Merged</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold font-mono text-white leading-none text-teal-400">
                {generalStats.mergedPRs}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Score contributions awarded</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Cum. Points</span>
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold font-mono text-yellow-400 leading-none">
                {generalStats.totalPoints}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Cumulate program points</p>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-red-950/20 border border-red-500/20 rounded-xl p-4 flex flex-col justify-between hover:border-red-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-red-300 uppercase tracking-widest">Security Flags</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold font-mono text-red-400 leading-none">
                {generalStats.suspiciousCount}
              </div>
              <p className="text-[10px] text-red-300/60 mt-1">Self-merges / caution flagged</p>
            </div>
          </div>
        </div>

        {/* Form success / message log banner */}
        {formSuccessMessage && (
          <div className="bg-teal-900/30 border border-teal-500/30 text-teal-200 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs animate-fadeIn shadow-[0_0_20px_rgba(20,184,166,0.1)]">
            <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold uppercase text-teal-400 block tracking-wider">Bot Automation Event Handler:</span>
              <p className="mt-0.5 text-teal-100">{formSuccessMessage}</p>
            </div>
          </div>
        )}

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT 5 COLS: Leaderboard, Cohorts and Add Candidate Form */}
          <section className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Fellow Rankings</h2>
                  <p className="text-xs text-slate-400">Contribution totals by tracked cohorts</p>
                </div>
                {/* Cohort Track Filters */}
                <select
                  value={activeTrackFilter}
                  onChange={(e) => setActiveTrackFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 rounded-lg py-1 px-2 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-all"
                >
                  <option value="">All Tracks (Global)</option>
                  <option value="AI">AI Track</option>
                  <option value="Full-Stack">Full-Stack Track</option>
                  <option value="DevOps">DevOps Track</option>
                  <option value="Security">Security Track</option>
                  <option value="Frontier">Frontier Tech Track</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter fellow by username or track..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-850 focus:border-slate-700 text-xs text-slate-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Table Rankings List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/60 pb-2 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 font-semibold text-center w-8">Rank</th>
                      <th className="py-2.5 font-semibold">Git Identity</th>
                      <th className="py-2.5 font-semibold">Track</th>
                      <th className="py-2.5 font-semibold text-center w-12">PRs</th>
                      <th className="py-2.5 font-semibold text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-[11px]">
                          No records matched filtering criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredRankings.map((f, i) => (
                        <tr
                          key={f._id}
                          className={`border-b border-slate-800/40 hover:bg-slate-800/20 transition-all ${
                            i === 0 ? "bg-amber-500/[0.02]" : i === 1 ? "bg-slate-200/[0.01]" : ""
                          }`}
                        >
                          <td className="py-2.5 text-center font-bold font-mono">
                            {i === 0 ? (
                              <span className="text-yellow-400 flex justify-center items-center gap-1">🥇 1</span>
                            ) : i === 1 ? (
                              <span className="text-slate-300 flex justify-center items-center gap-1">🥈 2</span>
                            ) : i === 2 ? (
                              <span className="text-amber-600 flex justify-center items-center gap-1">🥉 3</span>
                            ) : (
                              <span className="text-slate-400">{f.rank}</span>
                            )}
                          </td>
                          <td className="py-2.5 font-medium text-white">
                            <div className="flex items-center gap-2">
                              <img
                                src={f.avatarUrl || `https://avatars.githubusercontent.com/${f.username}`}
                                alt=""
                                className="w-5.5 h-5.5 rounded-full border border-slate-700 bg-slate-800 flex-shrink-0"
                                onError={(e) => {
                                  // fallback image
                                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${f.username}`;
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="font-semibold text-teal-300">@{f.username}</span>
                                <span className="text-[10px] text-slate-500 line-clamp-1">{f.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono tracking-wide ${
                                f.track === "AI"
                                  ? "bg-purple-950/60 text-purple-300 border border-purple-800/60"
                                  : f.track === "Full-Stack"
                                  ? "bg-blue-950/60 text-blue-300 border border-blue-800/60"
                                  : f.track === "DevOps"
                                  ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/60"
                                  : f.track === "Security"
                                  ? "bg-red-950/60 text-red-300 border border-red-800/60"
                                  : "bg-indigo-950/60 text-indigo-300 border border-indigo-800/60"
                              }`}
                            >
                              {f.track}
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-bold font-mono text-slate-300">
                            {f.mergedPRCount}
                          </td>
                          <td className="py-2.5 text-right font-bold font-mono text-emerald-400 text-sm">
                            {f.score} pts
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Add Form */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Enroll Fellow Candidate</h2>
                <p className="text-xs text-slate-400">Pre-bind custom names to tracks for the simulation hooks</p>
              </div>

              <form onSubmit={handleQuickAddFellow} className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block text-slate-400 font-mono mb-1">GitHub Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. purvansh-ieee"
                    value={newFellowGithub}
                    onChange={(e) => setNewFellowGithub(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Purvansh Joshi"
                    value={newFellowName}
                    onChange={(e) => setNewFellowName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Assigned Cohort Track</label>
                  <select
                    value={newFellowTrack}
                    onChange={(e) => setNewFellowTrack(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="AI">AI Track</option>
                    <option value="Full-Stack">Full-Stack</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Security">Security</option>
                    <option value="Frontier">Frontier</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="col-span-2 mt-2 bg-indigo-650 hover:bg-indigo-650/80 text-white font-medium p-2 rounded-lg transition-all border border-indigo-500/40 cursor-pointer text-center text-xs"
                >
                  Configure Entry Profile
                </button>
              </form>
            </div>
          </section>

          {/* MIDDLE 4 COLS: Active Webhook Event Simulator */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-teal-500/10 text-teal-300 font-mono text-[9px] uppercase font-bold tracking-widest px-2.5 py-1.5 rounded-bl-xl border-l border-b border-slate-800/80">
                Simulator Panel
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-teal-400" />
                  Webhook Simulator
                </h2>
                <p className="text-xs text-slate-400">Trigger authentic Github Webhooks directly to the bot API</p>
              </div>

              {/* Form Content */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Target Repository (Track Context)</label>
                  <select
                    value={selectedRepoId}
                    onChange={(e) => {
                      setSelectedRepoId(e.target.value);
                      const rep = repositories.find((r) => r.repoId === e.target.value);
                      if (rep) {
                        setSimPrTitle(`feat: Add resilient ${rep.track} core features & validation pipeline`);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  >
                    {repositories.map((r) => (
                      <option key={r._id} value={r.repoId}>
                        {r.fullName} ({r.track})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Sender (Author Fellow Username)</label>
                  <select
                    value={selectedFellowUsername}
                    onChange={(e) => setSelectedFellowUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="alex-dev">alex-dev (Full-Stack Fellow)</option>
                    <option value="priya-ai">priya-ai (AI Cohort)</option>
                    <option value="devops-sam">devops-sam (DevOps Fellow)</option>
                    <option value="clara-sec">clara-sec (Security Cohort)</option>
                    <option value="kenji_q">kenji_q (Frontier cohort)</option>
                    {newFellowGithub && <option value={newFellowGithub}>{newFellowGithub} (User Defined)</option>}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-slate-400 font-mono mb-1">PR #</label>
                    <input
                      type="number"
                      value={simPrNumber}
                      onChange={(e) => setSimPrNumber(parseInt(e.target.value) || 12)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-center font-mono focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-400 font-mono mb-1">Preset Simulation Event Mode</label>
                    <select
                      value={simEventPreset}
                      onChange={(e) => {
                        setSimEventPreset(e.target.value);
                        // modify text to match
                        if (e.target.value === "cheat-selfmerge") {
                          setSimPrTitle("🚨 direct bypass audit: force merge master");
                        } else if (e.target.value === "tamper-label-fellow") {
                          setSimPrTitle("Post Merge Tamper Attempt: Alex labeled PR #42 soc-hard");
                        } else {
                          const r = repositories.find((rep) => rep.repoId === selectedRepoId);
                          setSimPrTitle(`feat: Add resilient ${r?.track || "production"} API schemas`);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                    >
                      <optgroup label="1. PR Opened (Initial Track tags)">
                        <option value="opened-easy">PR Opened (soc-easy label)</option>
                        <option value="opened-medium">PR Opened (soc-medium label)</option>
                        <option value="opened-hard">PR Opened (soc-hard label)</option>
                        <option value="opened-draft">PR Opened (Draft mode)</option>
                      </optgroup>
                      <optgroup label="2. Pull Request Merged">
                        <option value="merged-easy">PR Merged (+10 Easy Points)</option>
                        <option value="merged-medium">PR Merged (+30 Medium Points)</option>
                        <option value="merged-hard">PR Merged (+60 Hard Points)</option>
                      </optgroup>
                      <optgroup label="3. Security & Rules Violations">
                        <option value="cheat-selfmerge">Self-Merge Alert (author === merger)</option>
                        <option value="tamper-label-fellow">Tamper Merged PR label (Block & Alert)</option>
                      </optgroup>
                      <optgroup label="4. Administrative Audit Adjustments">
                        <option value="adjust-label-mentor">Admin Label Discrepancy Adjustments</option>
                      </optgroup>
                      <optgroup label="5. Mentor Review Feedback">
                        <option value="mentor-review-fast">Mentor Speedy SLA Review (+15 mentor Score)</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Mock Payload Title</label>
                  <input
                    type="text"
                    value={simPrTitle}
                    onChange={(e) => setSimPrTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:outline-none font-mono"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-[10px] font-mono text-slate-400 leading-normal space-y-1">
                  <div className="text-slate-300 font-semibold border-b border-slate-850 pb-1 flex items-center justify-between">
                    <span>Generated Mock Payload Summary:</span>
                    <span className="text-teal-400 font-bold uppercase text-[9px]">JSON auto-constructed</span>
                  </div>
                  <div>- Event type header: <span className="text-purple-300 font-bold">{simEventPreset.startsWith("mentor-") ? "pull_request_review" : "pull_request"}</span></div>
                  <div>- Action parameters: <span className="text-teal-300 font-bold">{simEventPreset.startsWith("opened-") ? "opened" : simEventPreset.startsWith("merged-") || simEventPreset === "cheat-selfmerge" ? "closed [merged:true]" : simEventPreset.startsWith("tamper-") || simEventPreset.startsWith("adjust-") ? "labeled" : "submitted"}</span></div>
                  <div>- Sender identity: <span className="text-yellow-300 font-bold">@{simEventPreset.startsWith("mentor-") || simEventPreset.startsWith("adjust-") ? "mentor-sarah" : selectedFellowUsername}</span></div>
                  <div>- Points category allocation: <span className="text-white font-bold">{simEventPreset.includes("-easy") ? "10 points" : simEventPreset.includes("-medium") ? "30 points" : simEventPreset.includes("-hard") ? "60 points" : "0 points"}</span></div>
                </div>

                <button
                  type="button"
                  onClick={triggerSimulatedWebhook}
                  disabled={isLoading}
                  className="w-full bg-teal-650 hover:bg-teal-600 disabled:opacity-50 text-white font-medium p-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.1)] flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <Send className="w-4 h-4" />
                  {isLoading ? "Enqueuing Payload..." : "Fire Simulated Webhook"}
                </button>
              </div>
            </div>

            {/* Simulated webhook guidelines box */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 space-y-2 text-slate-400 text-[11px] leading-relaxed">
              <span className="font-semibold text-white block uppercase tracking-wider font-mono">Anti-Cheat Safeguards Built-in:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="text-slate-200 font-semibold">Self-Merge Hook</span>: Direct merges are flagged for review and score points restricted to 0.</li>
                <li><span className="text-slate-200 font-semibold">Label Protection</span>: If a fellow changes a merged PR's difficulty, the engine rejects, warns the user, and blocks points updates.</li>
                <li><span className="text-slate-200 font-semibold">SLA SLA tracking</span>: Mentors earn score multipliers for review approvals under 24 and 48 hours.</li>
              </ul>
            </div>
          </section>

          {/* RIGHT 3 COLS: Job Queue Status and System Action Logs */}
          <section className="lg:col-span-3 space-y-6">

            {/* LIVE PIPELINE MONITOR */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Pipeline Monitor</h2>
                  <p className="text-xs text-slate-400">BullMQ Background Workers logs</p>
                </div>
                {githubActionLogs.length > 0 && (
                  <button
                    onClick={handleClearLogs}
                    title="Clear Simulation logs"
                    className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-800/50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Navigation tabs inside monitor */}
              <div className="flex border-b border-slate-850 p-0.5 bg-slate-950/80 rounded-lg gap-1">
                <button
                  type="button"
                  onClick={() => setActiveLogTab("bullmq")}
                  className={`flex-1 text-center py-1.5 text-xs rounded-md transition-all font-medium ${
                    activeLogTab === "bullmq" ? "bg-slate-900 text-white shadow-sm font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Redis Queues
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLogTab("bot_ops")}
                  className={`flex-1 text-center py-1.5 text-xs rounded-md transition-all font-medium ${
                    activeLogTab === "bot_ops" ? "bg-slate-900 text-white shadow-sm font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Bot Outputs
                </button>
              </div>

              {/* Tabs Output */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {activeLogTab === "bullmq" ? (
                  // BullMQ Job Logs
                  jobLogs.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-[10px] space-y-1">
                      <div>No active background jobs.</div>
                      <div className="text-[9px] text-slate-600">Fire a webhook to spin up threads</div>
                    </div>
                  ) : (
                    jobLogs.map((j) => (
                      <div key={j.id} className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 text-[11px] font-mono hover:border-slate-800 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-200 truncate pr-2" title={j.id}>{j.id}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded uppercase text-[8px] font-bold tracking-widest ${
                              j.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : j.status === "processing"
                                ? "bg-cyan-500/10 text-cyan-400 animate-pulse"
                                : j.status === "failed"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-slate-500/10 text-slate-400"
                            }`}
                          >
                            {j.status}
                          </span>
                        </div>
                        <div className="text-slate-400 leading-normal mb-1">
                          Action: <span className="text-indigo-300">{j.data?.pull_request ? `${j.data.action} PR #${j.data.pull_request?.number}` : "Incoming hook check"}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-900/60 pt-1.5 mt-1.5">
                          <span>User: @{j.data?.sender?.login || "unknown"}</span>
                          <span>{new Date(j.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {j.error && (
                          <div className="bg-red-950/20 border border-red-500/20 text-red-400 p-1.5 mt-1.5 rounded text-[9px] font-mono break-all whitespace-pre-wrap">
                            {j.error}
                          </div>
                        )}
                      </div>
                    ))
                  )
                ) : (
                  // GitHub Action Logs
                  githubActionLogs.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-[10px]">
                      No recorded outbound events. Comments or Slack alerts will reflect here.
                    </div>
                  ) : (
                    githubActionLogs.map((l) => (
                      <div key={l.id} className="bg-slate-950/80 border border-slate-850 p-2.5 rounded-xl text-[10px] font-mono space-y-1">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold uppercase text-[8px] ${
                              l.type === "comment"
                                ? "bg-teal-500/10 text-teal-300"
                                : l.type === "alert"
                                ? "bg-red-500/10 text-red-300 border border-red-900/30"
                                : "bg-blue-500/10 text-blue-300"
                            }`}
                          >
                            {l.type === "comment" ? "📝 GH Comment" : l.type === "alert" ? "📢 Discord alert" : "API request"}
                          </span>
                          <span className="text-slate-500 text-[8px]">{new Date(l.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-slate-200 mt-1 break-words">{l.payload}</div>
                        <div className="text-slate-500 text-[8px] truncate">Target: {l.target}</div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>

            {/* ADVISORY: REPOSITORIES RESYNC ADMIN TOOLS */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Repository Resync</h2>
                <p className="text-xs text-slate-400">Force historical alignment via GitHub API and JWT credentials</p>
              </div>

              {!jwtToken ? (
                // JWT Admin login form
                <form onSubmit={handleAdminLogin} className="space-y-2.5 text-xs">
                  {adminError && <div className="text-[10px] text-red-400 bg-red-950/15 border border-red-900/30 p-2 rounded">{adminError}</div>}
                  <div>
                    <label className="block text-slate-400 mb-0.5">Admin Username</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5">Secret Key Password</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 font-mono"
                    />
                    <div className="text-[8px] text-slate-500 mt-0.5">Preset defaults: <span className="font-mono text-slate-400">admin / ieeesoc2026</span></div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-650 hover:bg-slate-700 hover:text-white text-slate-200 font-medium py-1.5 rounded transition-all border border-indigo-500/40 cursor-pointer"
                  >
                    Authenticate JWT Token
                  </button>
                </form>
              ) : (
                // Resync center
                <div className="space-y-3 text-xs">
                  <div className="bg-indigo-950/30 border border-indigo-500/30 text-indigo-300 p-2 rounded flex items-center justify-between font-mono text-[10px]">
                    <span>🔒 Admin token active</span>
                    <button onClick={() => setJwtToken("")} className="text-slate-400 hover:text-slate-200 uppercase font-extrabold text-[8px] tracking-wider">Logout</button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-400">Select active repository for synchronization audit:</label>
                    {repositories.map((r) => (
                      <button
                        key={r._id}
                        type="button"
                        onClick={() => handleRepositoryResync(r.repoId, r.name)}
                        disabled={isLoading}
                        className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 p-2 rounded-lg text-left transition-all leading-normal flex items-center justify-between font-mono text-[10px] text-slate-300 cursor-pointer group"
                      >
                        <span className="truncate pr-2">{r.fullName}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>

                  {resyncLogs.length > 0 && (
                    <div className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 font-mono text-[9px] uppercase space-y-1 text-slate-400">
                      <div className="text-white border-b border-slate-900 font-bold pb-1 flex items-center justify-between">
                        <span>Resync process Logs:</span>
                        {resyncSummary && (
                          <span className="text-emerald-400">Reconciled: +{resyncSummary.pointsAdjusted} pts</span>
                        )}
                      </div>
                      <div className="max-h-[140px] overflow-y-auto space-y-1 leading-normal text-[8px]">
                        {resyncLogs.map((log, li) => (
                          <div key={li} className="break-words font-mono font-medium">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </section>

        </div>
      </main>

      {/* Decorative credit footer footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 mt-12 text-center text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-6 space-y-2">
          <p className="font-bold text-slate-400">🤖 IEEEsoc-Bot Contribution Manager Engine &copy; 2026</p>
          <p className="text-[10px] max-w-xl mx-auto leading-normal">
            Automating pull-request lifecycle scoring, co-authored points distribution, and peer mentorship speed-auditing. Powered by Node.js, Express.js, Mongoose, and BullMQ in high-concurrency environments.
          </p>
        </div>
      </footer>
    </div>
  );
}
