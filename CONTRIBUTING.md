# Contributing Guidelines

Welcome to the **IEEESoc Fellowship Program**! This document outlines the contribution workflow, naming conventions, coding standards, and how to work with the **IEEESoc Bot** scoring engine.

---

## 💻 Fellow Contribution Workflow

### 1. Scouting & Assigned Repositories
*   You will be matched to specific repositories depending on your chosen track (`AI`, `Full-Stack`, `DevOps`, `Security`, or `Frontier`).
*   Ensure your GitHub account is enrolled in our database (provisioned on the fly or pre-registered).

### 2. Working on Issues
*   Claim vetted issues from your matched repository.
*   Before starting, confirm the issue difficulty label:
    *   `soc-easy` (+10 points)
    *   `soc-medium` (+30 points)
    *   `soc-hard` (+60 points)

### 3. Submitting Pull Requests
*   **Branch Naming**: Use clean branch structures, e.g., `feat/add-jwt-auth` or `fix/db-leak`.
*   **Pull Request Description**: Include a clear description of the implementation.
    *   ⚠️ *Important*: Keep descriptions above **10 words**; otherwise, the bot will auto-flag it and comment prompting for details.
*   **Collaborators**: If you co-authored the work with another fellow, declare them in the commit body using:
    ```
    Co-authored-by: CoAuthorUsername <coauthor@email.com>
    ```
    The bot will parse this and award them a **50% points share** automatically.

### 4. Direct Merges (Anti-Cheat)
*   **Do not merge your own Pull Request.**
*   Direct self-merges trigger the self-merge warning, suspend all points to **0**, flag the PR as suspicious, and ping the IEEE Committee on Discord.
*   Always wait for an approved review from your assigned Mentor.

---

## 🛡️ Mentor Review Guidelines

To keep the development pipeline moving efficiently, Mentors should adhere to the following:

*   **Review Timeliness (SLA)**:
    *   First review submitted within **24 hours**: Awards **+15 mentor points**.
    *   First review submitted within **48 hours**: Awards **+5 mentor points**.
    *   Review submitted after **48 hours**: **0 points**.
*   **PR Categorization**: Assign the appropriate difficulty label (`soc-easy`, `soc-medium`, `soc-hard`) prior to merge.
*   **Post-Merge Reclassifications**: If a PR was merged unlabeled (scoring 0), a Mentor or Admin can apply the label post-merge to trigger a points recalculation. Fellows are strictly blocked from changing labels post-merge.
