import Redis from "ioredis";
import { Queue as BullQueue, Worker as BullWorker } from "bullmq";

export interface IBotQueue {
  add(name: string, data: any): Promise<any>;
}

export interface IRedisDeduplicator {
  isDuplicate(deliveryId: string): Promise<boolean>;
}

let isRealRedis = false;
let redisClient: any = null;
let webhookQueue: IBotQueue;
let deduplicator: IRedisDeduplicator;

// Set up a structured log system for tracking background job status in the UI
export interface IJobLog {
  id: string;
  name: string;
  data: any;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  timestamp: Date;
}

export const jobLogsState: IJobLog[] = [];

export function logJobEvent(job: Omit<IJobLog, "timestamp">) {
  const existingIndex = jobLogsState.findIndex((j) => j.id === job.id);
  if (existingIndex !== -1) {
    jobLogsState[existingIndex] = { ...jobLogsState[existingIndex], ...job, timestamp: new Date() };
  } else {
    jobLogsState.unshift({ ...job, timestamp: new Date() });
  }
}

// Custom Virtual Task Runner simulating BullMQ background execution
class MockBotQueue implements IBotQueue {
  private static jobCounter = 0;

  async add(name: string, data: any): Promise<any> {
    const jobId = `sim-job-${Date.now()}-${++MockBotQueue.jobCounter}`;
    console.log(`📥 [Mock Queue] Enqueued job: ${name} (ID: ${jobId})`);
    
    logJobEvent({
      id: jobId,
      name,
      data,
      status: "pending"
    });

    // Execute job asynchronously with a realistic 1-second background processing delay
    setTimeout(async () => {
      try {
        logJobEvent({ id: jobId, name, data, status: "processing" });
        console.log(`🏃‍♂️ [Mock Worker] Launching task handler for job ID: ${jobId}`);
        
        // Dynamically invoke the webhook worker processor to prevent circular dependency
        const { processWebhookJob } = await import("../workers/webhookWorker");
        await processWebhookJob(data);

        logJobEvent({ id: jobId, name, data, status: "completed" });
        console.log(`✨ [Mock Worker] Job completed successfully: ${jobId}`);
      } catch (err: any) {
        logJobEvent({ id: jobId, name, data, status: "failed", error: err.message });
        console.error(`❌ [Mock Worker] Job failed: ${jobId}. Error:`, err);
      }
    }, 1200);

    return { id: jobId };
  }
}

class MockDeduplicator implements IRedisDeduplicator {
  private cache = new Set<string>();

  async isDuplicate(deliveryId: string): Promise<boolean> {
    if (this.cache.has(deliveryId)) {
      return true;
    }
    this.cache.add(deliveryId);
    // Auto-expiry simulation after 24 hrs corresponding to TTL 86400
    setTimeout(() => {
      this.cache.delete(deliveryId);
    }, 24 * 60 * 60 * 1000);
    return false;
  }
}

export function initializeRedisAndQueue() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // mandatory for BullMQ
      });

      redisClient.on("error", (err: any) => {
        console.warn("⚠️ Redis client connection error:", err.message);
      });

      // Build real BullMQ config
      const connectionConfig = {
        host: redisUrl.split("@")[1]?.split(":")[0] || "localhost",
        port: parseInt(redisUrl.split(":").pop() || "6379"),
      };

      const realQueue = new BullQueue("webhook-queue", { connection: redisClient });
      
      webhookQueue = {
        add: async (name: string, data: any) => {
          const job = await realQueue.add(name, data);
          return { id: job.id };
        }
      };

      deduplicator = {
        isDuplicate: async (deliveryId: string) => {
          const key = `github-deliveryId:${deliveryId}`;
          const isDup = await redisClient.set(key, "1", "NX", "EX", 86400);
          return isDup === null;
        }
      };

      isRealRedis = true;
      console.log("📡 Connected to external Redis and bound BullMQ Queue instances.");

      // Mount the long-running worker if live Redis exists
      import("../workers/webhookWorker").then(({ startRealBullMQWorker }) => {
        startRealBullMQWorker(redisClient);
      });

      return;
    } catch (err) {
      console.warn("⚠️ Real Redis connection attempt threw exception. Booting simulated Redis context instead.");
    }
  }

  // Fallback Setup
  webhookQueue = new MockBotQueue();
  deduplicator = new MockDeduplicator();
  isRealRedis = false;
  console.log("🧊 Active virtual/in-memory Redis engine & mock asynchronous thread workers running.");
}

export { isRealRedis, redisClient, webhookQueue, deduplicator };
