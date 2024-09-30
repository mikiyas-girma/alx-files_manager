import { createClient } from "redis";
import { promisify } from "util";

class RedisClient {
  constructor() {
    this.redis = createClient();
    this.redis.on("error", (err) => {
      console.log("redis client error: ", err);
    });
  }

  isAlive() {
    if (this.redis.connected) {
      return true;
    }
    return false;
  }

  async get(key) {
    const redisGet = promisify(this.redis.get).bind(this.redis);
    const value = await redisGet(key);
    return value;
  }

  async set(key, value, duration) {
    const redisSetex = promisify(this.redis.setex).bind(this.redis);
    await redisSetex(key, duration, value);
  }

  async del(key) {
    const redisDel = promisify(this.redis.del).bind(this.redis);
    await redisDel(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
