import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  githubId: string;
  username: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "fellow" | "mentor" | "admin" | "viewer";
  track?: "AI" | "Full-Stack" | "DevOps" | "Security" | "Frontier";
  assignedRepo?: mongoose.Types.ObjectId;
  score: number;
  mentorScore: number;
  isActive: boolean;
  joinedAt: Date;
}

const UserSchema = new Schema<IUser>({
  githubId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  avatarUrl: { type: String },
  role: { 
    type: String, 
    enum: ["fellow", "mentor", "admin", "viewer"], 
    default: "fellow" 
  },
  track: { 
    type: String, 
    enum: ["AI", "Full-Stack", "DevOps", "Security", "Frontier"],
    required: function(this: IUser) {
      return this.role === "fellow";
    }
  },
  assignedRepo: { type: Schema.Types.ObjectId, ref: "Repository" },
  score: { type: Number, default: 0, index: true },
  mentorScore: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now }
});

// Avoid compiling the model multiple times in high-reload environment
const UserModel: mongoose.Model<IUser> = mongoose.models.User as mongoose.Model<IUser> || mongoose.model<IUser>("User", UserSchema);
export default UserModel;
