import { createClient } from "redis";
import { promisify } from "util";

class RedisClient {
  constructor() {
    this.redis = createClient();
    this.isRedisConnected = true;
    this.redis.on("error", (err) => {
      this.isRedisConnected = false;
      console.log("redis client error: ", err);
    });
    this.redis.on("connect", () => {
      this.isRedisConnected = true;
      console.log("redis client connected");
    });
  }

  isAlive() {
    return this.isRedisConnected;
  }

  async get(key) {
    const redisGet = promisify(this.redis.get).bind(this.redis);
    const value = await redisGet(key);
    return value;
  }

  async set(key, value, duration) {
    const redisSetex = promisify(this.redis.SETEX).bind(this.redis);
    await redisSetex(key, duration, value);
  }

  async del(key) {
    const redisDel = promisify(this.redis.del).bind(this.redis);
    await redisDel(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
