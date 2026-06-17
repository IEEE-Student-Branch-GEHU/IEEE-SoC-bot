# Scoring Engine & Rules Specification

The **IEEEsoc-Bot** scoring engine is a dual-gamification system designed to incentivize high-quality contributions from Fellows and active, timely feedback from Mentors. This document specifies the mathematical formulas, scoring tiers, review SLAs, and anti-cheat mechanisms.

---

## 1. Fellow Contribution Scoring

Fellows earn points strictly based on merged contributions. Pull requests that are closed without being merged, or PRs that remain in a draft state, receive zero points.

### 1.1 Difficulty Tiers and Criteria

Upon merging a PR, the bot reads the difficulty label assigned by the repository maintainer. The table below outlines the points and qualitative guidelines for each tier:

| Label | Points | Intended Scope & Examples | Validation Rules |
| :--- | :--- | :--- | :--- |
| `soc-easy` | **+10** | * Typo corrections, README updates, or markdown fixes.<br/>* Small CSS styling tweaks.<br/>* Adding simple comments or logging lines. | Minimal logic changes. Often < 10 lines of code. |
| `soc-medium` | **+30** | * Standard features (e.g., creating a new API endpoint).<br/>* Bug fixes solving logical issues.<br/>* Adding new unit or integration tests.<br/>* Database schema migrations. | Requires logical changes, testing, and functional code review. |
| `soc-hard` | **+60** | * Core architecture modifications (e.g., changing state management).<br/>* Major database refactoring or query performance optimization.<br/>* Resolving security vulnerabilities (e.g., fixing SQLi/NoSQLi).<br/>* Deploying smart contracts / Web3 integrations. | High-complexity changes that impact critical system modules. |

### 1.2 Unlabeled Pull Requests
If a Pull Request is merged without one of the three `soc-*` labels, the bot:
1. Records the merge in the database with `difficultyLabel: "unlabeled"` and `pointsAwarded: 0`.
2. Leaves a comment on the merged PR prompting the maintainer:
   > 🤖 **IEEEsoc-Bot**: This PR has been merged without a difficulty label. Maintainers, please add `soc-easy`, `soc-medium`, or `soc-hard` to award points to @[ContributorUsername].
3. Listens for the label addition event (even post-merge) and automatically awards the correct points retroactively once the label is applied.

---

## 2. Mentor Excellence Scoring

To ensure students are not blocked, mentors are scored based on responsiveness and review depth. This promotes active mentorship and establishes the **Mentorship Excellence Leaderboard**.

### 2.1 Review SLA (Service Level Agreement)
The bot tracks the time difference ($T$) between when a PR becomes **Ready for Review** (i.e., when it is opened, or when it is converted from a Draft to a non-draft state) and when the Mentor submits their **first review** (Approved, Request Changes, or Comment).

$$T = \text{Time of First Review} - \text{Time of PR Ready for Review}$$

Points are awarded to the reviewing Mentor's profile based on the following timeline:

| Turnaround Time ($T$) | Points Awarded | Notes |
| :--- | :--- | :--- |
| $T \le 24 \text{ hours}$ | **+15** | Prompt Review Award |
| $24 \text{ hours} < T \le 48 \text{ hours}$ | **+5** | On-Time Review Award |
| $T > 48 \text{ hours}$ | **0** | No points (Missed SLA) |

### 2.2 Milestone Completion Bonus
Mentors invest significant 1-on-1 time preparing Fellows for major gates. To reward this, when a Fellow successfully passes the **Mid-Term Gate** (>= 50% roadmap complete and verified), the matched Mentor receives a **+50 point bonus**.

---

## 3. Anti-Cheat & Spam Detection

To preserve leaderboard integrity, the bot actively monitors and mitigates attempts to manipulate the scoring engine.

### 3.1 Self-Merge Prevention
Some Fellows may have write access to repositories. If a Fellow merges their own PR without an independent review approval:
* The bot flags the PR status in the database as `suspicious: true`.
* The points awarded for that PR are set to `0`.
* The bot posts a comment on the PR and sends a Discord alert to the IEEE Core Committee:
  > ⚠️ **IEEEsoc-Bot Alert**: PR #12 was merged by its author @[FellowName] without independent review. Points have been suspended pending organizer verification.

### 3.2 Retroactive Label Tampering Detection
If a label is changed on a merged PR (e.g., from `soc-easy` to `soc-hard` to artificially inflate scores):
1. The bot captures the `unlabeled` or `labeled` webhook event.
2. It validates the user who changed the label. If the action was performed by the PR author (Fellow), the bot reverts the label (if it has permissions) and keeps the points at the previous level, logging a warning.
3. If performed by an authorized Mentor/Admin, the bot calculates the point difference:

$$\text{Delta} = \text{Points}(\text{New Label}) - \text{Points}(\text{Old Label})$$

4. The bot updates the Fellow's total score in the database by adding the $\text{Delta}$ and creates an audit entry in `PointsLog`.

### 3.3 Low-Effort PR Flagging
If a PR is labeled `soc-medium` or `soc-hard` but has minimal code modifications (e.g., $< 5$ lines of changes, or only whitespace changes):
* The bot logs a caution flag in the dashboard.
* It does not block the points automatically (to respect Mentor autonomy) but adds a system review flag for the IEEE Core Committee's qualitative audit during final evaluations.

---

## 4. Edge Cases & Handling Logic

### 4.1 Co-Authored Pull Requests
If a PR contains `Co-authored-by: Name <email>` metadata in its commit messages:
* The primary author (PR opener) receives $100\%$ of the base points.
* Recognized co-authors (who must also be registered Fellows in the DB) receive $50\%$ of the base points.
* Points are calculated and rounded to the nearest integer.

### 4.2 Reopening and Re-merging
If a merged PR is somehow reopened and merged again:
* The bot checks the database to see if `PullRequest.state` was already marked `merged` and `pointsAwarded > 0`.
* If true, the bot ignores the second merge event and awards `0` points, preventing double-counting.

### 4.3 Git Force-Pushes
If a force-push (`git push --force`) occurs on an open PR:
* The bot logs the event and clears any existing "review approvals" status in the DB, requiring the Mentor to review the newly pushed changes before a merge can award points.
