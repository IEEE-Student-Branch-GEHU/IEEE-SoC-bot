export type DifficultyLabel = "soc-easy" | "soc-medium" | "soc-hard" | "unlabeled";
export type Track = "AI" | "Full-Stack" | "DevOps" | "Security" | "Frontier";

export function inferTrackFromName(repoName: string): Track {
  const norm = repoName.toLowerCase();
  if (norm.includes("ai")) return "AI";
  if (norm.includes("web") || norm.includes("stack") || norm.includes("backend") || norm.includes("frontend")) return "Full-Stack";
  if (norm.includes("devops") || norm.includes("infra") || norm.includes("ci")) return "DevOps";
  if (norm.includes("sec") || norm.includes("cyber") || norm.includes("scanner")) return "Security";
  return "Frontier";
}

export function getDifficultyFromLabels(labels: any[]): DifficultyLabel {
  for (const label of labels) {
    const name = typeof label === "string" ? label : label.name;
    if (name === "soc-easy") return "soc-easy";
    if (name === "soc-medium") return "soc-medium";
    if (name === "soc-hard") return "soc-hard";
  }
  return "unlabeled";
}

export function getPointsForLabel(difficulty: DifficultyLabel): number {
  switch (difficulty) {
    case "soc-easy": return 10;
    case "soc-medium": return 30;
    case "soc-hard": return 60;
    default: return 0;
  }
}