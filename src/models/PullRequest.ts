import mongoose, { Schema, Document } from "mongoose";

export interface IReview {
  reviewer: mongoose.Types.ObjectId;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | string;
  submittedAt: Date;
}

export interface IPullRequest extends Document {
  prId: string;
  prNumber: number;
  repository: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  title: string;
  htmlUrl: string;
  state: "open" | "closed" | "merged";
  isDraft: boolean;
  difficultyLabel: "soc-easy" | "soc-medium" | "soc-hard" | "unlabeled";
  pointsAwarded: number;
  suspicious: boolean;
  createdAt: Date;
  closedAt?: Date;
  mergedAt?: Date;
  reviews: IReview[];
  turnaroundTimeSeconds?: number;
}

const PullRequestSchema = new Schema<IPullRequest>({
  prId: { type: String, required: true, unique: true, index: true },
  prNumber: { type: Number, required: true },
  repository: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  htmlUrl: { type: String, required: true },
  state: { 
    type: String, 
    enum: ["open", "closed", "merged"], 
    default: "open" 
  },
  isDraft: { type: Boolean, default: false },
  difficultyLabel: { 
    type: String, 
    enum: ["soc-easy", "soc-medium", "soc-hard", "unlabeled"], 
    default: "unlabeled" 
  },
  pointsAwarded: { type: Number, default: 0 },
  suspicious: { type: Boolean, default: false },
  createdAt: { type: Date, required: true },
  closedAt: { type: Date },
  mergedAt: { type: Date },
  reviews: [{
    reviewer: { type: Schema.Types.ObjectId, ref: "User" },
    state: { type: String },
    submittedAt: { type: Date, default: Date.now }
  }],
  turnaroundTimeSeconds: { type: Number }
});

const PullRequestModel: mongoose.Model<IPullRequest> = mongoose.models.PullRequest as mongoose.Model<IPullRequest> || mongoose.model<IPullRequest>("PullRequest", PullRequestSchema);
export default PullRequestModel;
