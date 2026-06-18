import mongoose, { Schema, Document } from "mongoose";

export interface IRepository extends Document {
  repoId: string;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  track: "AI" | "Full-Stack" | "DevOps" | "Security" | "Frontier";
  mentors: mongoose.Types.ObjectId[];
  fellows: mongoose.Types.ObjectId[];
  installationId: string;
  isActive: boolean;
}

const RepositorySchema = new Schema<IRepository>({
  repoId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  owner: { type: String, required: true },
  htmlUrl: { type: String, required: true },
  track: { 
    type: String, 
    enum: ["AI", "Full-Stack", "DevOps", "Security", "Frontier"], 
    required: true 
  },
  mentors: [{ type: Schema.Types.ObjectId, ref: "User" }],
  fellows: [{ type: Schema.Types.ObjectId, ref: "User" }],
  installationId: { type: String, required: true },
  isActive: { type: Boolean, default: true }
});

const RepositoryModel: mongoose.Model<IRepository> = mongoose.models.Repository as mongoose.Model<IRepository> || mongoose.model<IRepository>("Repository", RepositorySchema);
export default RepositoryModel;
