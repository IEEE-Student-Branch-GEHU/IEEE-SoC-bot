# Product Requirements Document (PRD)

## Document Metadata
* **Project Name**: IEEEsoc-Bot
* **Version**: 1.0.0
* **Date**: June 17, 2026
* **Status**: Approved for Development
* **Authors**: IEEE Student Branch GEHU Core Committee & Development Team

---

## 1. Executive Summary & Vision

### 1.1 Background
IEEEsoc'26 is a 12-week hybrid open-source fellowship program run by the IEEE Student Branch (IEEE-SB) at Graphic Era Hill University (GEHU), in partnership with the Department of Computer Science & Engineering. The program shifts the traditional hackathon paradigm by skipping proposal rounds and selecting participants based on verified "proof of work" (GitHub history, code quality, and professional profile). Selected student developers ("Fellows") are matched with real-world, high-impact repositories to work under the guidance of project maintainers ("Mentors/Admins").

### 1.2 The Role of IEEEsoc-Bot
Managing mentorship and tracking contributions at a national scale (100+ projects, 250+ fellows) presents severe logistical challenges. The **IEEEsoc-Bot** is the core automation engine of the program. It acts as an automated, impartial coordinator installed across all participating GitHub repositories. By capturing webhook events, reading difficulty labels, calculating points, and syncing with the central web platform, the bot eliminates manual tracking, powers a real-time leaderboard, and flags inactive collaborations.

### 1.3 Strategic Objectives
* **Eliminate Tutorial Hell**: Move students from sandbox repositories to production-ready open-source codebases.
* **Scalable Mentorship**: Automate the tracking, verification, and scoring of contributions to reduce the administrative burden on IEEE organizers.
* **Fair Gamification**: Establish a transparent, automated scoring engine that motivates both Fellows (through contributions) and Mentors (through timely reviews).
* **Alumni Network Building**: Create a verifiable, long-term developer portfolio mapped directly to open-source records.

---

## 2. Target Audience & Personas

### 2.1 Fellows (Student Contributors)
* **Goal**: Build high-quality features, fix bugs, earn leaderboard points, and qualify for the Elite 10 national showcase.
* **Interaction**: Submits Pull Requests (PRs) to their matched repository, formats commits according to program standards, and interacts with Mentors on GitHub and Discord.

### 2.2 Mentors / Project Admins
* **Goal**: Select elite talent, guide Fellows, review and merge contributions, and maintain codebase quality.
* **Interaction**: Reviews PRs within the SLA, assigns difficulty labels (`soc-easy`, `soc-medium`, `soc-hard`) to PRs, and receives mentorship scores.

### 2.3 IEEE Core Committee (Organizers)
* **Goal**: Oversee the entire program, run orientations, resolve disputes, monitor project health, and administer final evaluations.
* **Interaction**: Configures bot settings, monitors the central dashboard, receives alerts about silent repository pairings, and conducts qualitative reviews of high-impact PRs.

### 2.4 Public Viewers & Sponsors
* **Goal**: Track progress, observe leaderboard standing, verify student achievements, and discover vetted talent.
* **Interaction**: Consumes the live public leaderboard and individual developer profiles on the central website.

---

## 3. Reconciled Program Timeline & Milestones

The program runs from **June 1, 2026, to September 1, 2026**. The 10-week contribution sprint is divided into five bi-weekly sprints to ensure consistent pacing.

```
+------------------------------------------------------------------------------------+
| Phase 1: Scouting & Selection | Phase 2: Bonding | Phase 3B: Contribution Sprints | Showcase
| June 1 - June 15              | June 15 - June 22| June 22 - Aug 31 (5 Sprints)   | Sept 1
+------------------------------------------------------------------------------------+
                                ^                  ^               ^
                         Phase 2 PR Due     Mid-Term Gate   Final Evaluation
                           (June 22)          (July 27)      (Aug 24-Aug 31)
```

| Phase | Sub-Phase / Milestone | Start Date | End Date | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Scouting & Selection | Jun 1, 2026 | Jun 15, 2026 | Unstop screening, GitHub auditing, admin vetting, stack-based matching on IEEEsoc web platform. |
| **Phase 2** | Bonding & Architecture | Jun 15, 2026 | Jun 22, 2026 | Codebase audits, Roadmap sync, Discord onboarding, and mandatory **Phase 2 Smoke-Test PR** merge. |
| **Phase 3A** | Committee Operations Setup | Jun 15, 2026 | Jun 22, 2026 | Bot installation across 100+ repos, leaderboard initialization, and Fellow/Mentor points system orientation. |
| **Phase 3B** | **Sprint 1** | Jun 22, 2026 | Jul 6, 2026 | Contribution kickoff. Bot begins scoring merged PRs. |
| **Phase 3B** | **Sprint 2** | Jul 6, 2026 | Jul 20, 2026 | Core contribution sprint; bi-weekly leaderboard checkpoints. |
| **Phase 3B** | **Sprint 3 (Mid-Term)** | Jul 20, 2026 | Aug 3, 2026 | **Mid-Term Gate (July 27)**: Fellows must show >= 50% roadmap completion; underperformers offboarded. |
| **Phase 3B** | **Sprint 4** | Aug 3, 2026 | Aug 17, 2026 | Advanced feature development, testing, and system integrations. |
| **Phase 3B** | **Sprint 5 (Final Sprints)** | Aug 17, 2026 | Aug 31, 2026 | **Final Evaluation Window (Aug 24-31)**: Qualitative reviews of Hard PRs by experts to determine the Elite 10. |
| **Phase 4** | National Showcase / Grand Finale | Sept 1, 2026 | Sept 1, 2026 | 1-day live grand merge, GEHU faculty evaluation, lightning talks, awards ceremony, and Hall of Fame archive. |

---

## 4. Reconciled Project Tracks & Tech Tags

To consolidate project classification, the 100+ accepted projects are mapped to five core domains:

| Track | Domain | Focus Areas | Recommended Tech Tags |
| :--- | :--- | :--- | :--- |
| **T-1** | **AI/ML & Data Engineering** | Deep Learning, NLP, Data Pipelines, LLM Agents | `#PyTorch`, `#TensorFlow`, `#LLMs`, `#LangChain`, `#HuggingFace`, `#Scikit-Learn`, `#Pandas` |
| **T-2** | **Full-Stack & Mobile Dev** | Web apps, API design, Native & Cross-Platform mobile | `#ReactJS`, `#NextJS`, `#Flutter`, `#FastAPI`, `#ExpressJS`, `#PostgreSQL`, `#TailwindCSS` |
| **T-3** | **Cloud/Infra & DevOps** | Systems programming, orchestration, CI/CD, IaC | `#Rust`, `#Docker`, `#Kubernetes`, `#Terraform`, `#GitHubActions`, `#AWS`, `#Linux` |
| **T-4** | **Security & Decentralization** | Web3, smart contracts, static analysis, penetration testing | `#Solidity`, `#Cryptography`, `#OWASP`, `#Go`, `#SmartContracts`, `#RustSecurity` |
| **T-5** | **Research & Frontier Tech** | Simulation, robotics, hardware interfacing, physical systems | `#QuantumComputing`, `#ROS2`, `#Arduino`, `#Simulation`, `#C++`, `#MATLAB` |

---

## 5. Functional Requirements

### F-1: Automatic Pull Request Lifecycle Tracking
* **F-1.1**: The bot must monitor PR open, draft, edit, request review, assign, and close events across all 100+ repositories.
* **F-1.2**: PR status changes must be logged and sent in real time to the central database, keeping the student profile current.
* **F-1.3**: The bot must enforce commit naming conventions and pull request formats (e.g., matching issue link present) and add comment warnings if guidelines are violated.

### F-2: Administrative Difficulty Label Interpretation
* **F-2.1**: The bot must listen for label addition/removal events on pull requests.
* **F-2.2**: Only repository owners, authorized maintainers, or IEEE admins can assign difficulty labels:
  * `soc-easy` (10 points)
  * `soc-medium` (30 points)
  * `soc-hard` (60 points)
* **F-2.3**: If a PR is merged without an assigned difficulty label, the bot must post a prompt asking the maintainer to assign a label, temporarily withholding points until categorized.

### F-3: Score Calculation and Database Persistence
* **F-3.1**: Points must be awarded immediately upon successful **Merge** of the PR into the target branch. Reopened and re-merged PRs must not double-count.
* **F-3.2**: The bot must track the specific Fellow (author of the PR) and update their total score in the database.
* **F-3.3**: The bot must record Mentor scores based on review SLAs (time between PR open/ready-for-review and first review action).

### F-4: Live Leaderboard Synchronization
* **F-4.1**: The backend database must synchronize updates immediately after points are processed.
* **F-4.2**: The bot must emit update payloads to trigger frontend cache invalidation, ensuring the national public leaderboard displays real-time standings.

### F-5: Silent & Unresponsive Pairing Monitoring
* **F-5.1**: The bot must track inactivity periods on matched pairings (e.g., no PR activity, comments, or reviews for 5 consecutive days).
* **F-5.2**: The bot must alert IEEE organizers via Discord webhook or Slack alert when a Fellow or Mentor goes silent, enabling rapid intervention.

---

## 6. Non-Functional Requirements

### N-1: Performance & Webhook Latency
* **N-1.1**: The bot server must process GitHub webhooks within **3 seconds** of receipt.
* **N-1.2**: High webhook bursts (e.g., during sprint deadlines or the Grand Merge on Sept 1) must be handled using an asynchronous message queue (e.g., Redis/BullMQ) to prevent API timeout errors.

### N-2: Scalability
* **N-2.1**: The system must handle concurrent events from **100+ active repositories** and up to **250 active Fellows**.
* **N-2.2**: The database must handle frequent read queries for the public leaderboard while performing atomic increments for user scores.

### N-3: Security & Verification
* **N-3.1**: The bot must validate the cryptographic signature (`X-Hub-Signature-256`) of every incoming webhook using the GitHub App's client secret.
* **N-3.2**: Role-based access control (RBAC) must prevent Fellows from modifying labels or triggering manual score updates on their own PRs.

### N-4: Availability
* **N-4.1**: The bot API must maintain **99.9% uptime** throughout the fellowship (June 1 – September 1).
* **N-4.2**: In case of server failure, the bot must be able to replay missed webhooks from GitHub's delivery logs.

---

## 7. Key Performance Indicators (KPIs)

* **Webhook Processing Success Rate**: > 99.9% successful processing (HTTP 200/202 responses).
* **Leaderboard Sync Latency**: < 5 seconds from PR merge to leaderboard update.
* **Average Review Turnaround (Mentor SLA)**: Percentage of PRs reviewed within 24 hours.
* **Silent Pairing Detection Latency**: Alert generated within 6 hours of a pairing crossing the 5-day inactivity limit.

---

## 8. Constraints & Out-of-Scope Items

### 8.1 Constraints
* **GitHub API Limits**: The bot must operate within the GitHub App rate limits (5,000 requests per hour per installation, scaling with repository size). Heavy calls (like fetching full file diffs) should be minimized.
* **Hosting Budget**: The core infrastructure must remain lightweight to run on affordable cloud hosting (e.g., Render, AWS EC2 Micro, or Fly.io).

### 8.2 Out-of-Scope
* **IDE Integrations**: The bot will not provide in-IDE code intelligence; all interactions are hosted on GitHub, Discord, or the central website.
* **Plagiarism Detection**: While the bot checks for simple spam patterns, deep syntax-based plagiarism checks of student code are handled out-of-band by static analysis tools or manual mentor reviews.
