import dbClient from "../utils/db";
import redisClient from "../utils/redis";

class AppController {
  static getStatus(request, response) {
    response.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static async getStats(request, response) {
    const tot_users = await dbClient.nbUsers();
    const tot_files = await dbClient.nbFiles();
    response.status(200).json({
      users: tot_users,
      files: tot_files,
    });
  }
}

module.exports = AppController;
