import mongoose from "mongoose";

// In-Memory MongoDB Server for fallback/demo environments
let mongod: any = null;

// Seed initial database state for premium demo fidelity
async function seedDefaultData() {
  try {
    console.log("🌱 Starting with a completely empty, production-ready starting database.");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  }
}

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log("📡 Connected to external MongoDB Database.");
      return;
    } catch (err) {
      console.warn("⚠️ Could not connect to external MongoDB. Falling back to in-memory runtime db.");
    }
  }

  // Fallback to Mongo Memory Server
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`🧊 Spun up in-memory MongoDB replica at: ${uri}`);
    
    // Seed default data for immediate visual fidelity
    await seedDefaultData();
  } catch (err) {
    console.error("❌ Failed to create in-memory MongoDB server:", err);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}
