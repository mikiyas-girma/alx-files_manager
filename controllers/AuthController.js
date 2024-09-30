import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import sha1 from "sha1";
import { v4 as uuidv4 } from "uuid";

class AuthController {
  static async getConnect(request, response) {
    const authData = request.header("Authorization");
    let credentials = authData.split(" ")[1];
    const credentialsBuffer = Buffer.from(credentials, "base64");
    credentials = credentialsBuffer.toString("ascii");
    const cred = credentials.split(":");

    if (cred.length !== 2) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }
    const hashed_password = sha1(cred[1]);
    const users = dbClient.db.collection("users");
    users.findOne(
      { email: cred[0], password: hashed_password },
      async (err, user) => {
        if (user) {
          const token = uuidv4();
          const key = `auth_${token}`;
          const duration = 24 * 60 * 60; // equals to 24 hours
          await redisClient.set(key, user._id.toString(), duration);
          response.status(200).json({ token });
        } else {
          response.status(401).json({ error: "Unauthorized" });
        }
      }
    );
  }

  static async getDisconnect(request, response) {
    const token = request.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (userId) {
      await redisClient.del(key);
      response.status(204).json({});
    } else {
      response.status(401).json({ error: "Unauthorized" });
    }
  }
}

module.exports = AuthController;
