import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import sha1 from "sha1";
import { ObjectID } from "mongodb";
import Queue from "bull";

const userQueue = new Queue("userQueue");

class UsersController {
  static postNew(request, response) {
    const { email, password } = request.body;

    if (!email) {
      return response.status(400).json({ error: "Missing email" });
    }

    if (!password) {
      response.status(400).json({ error: "Missing password" });
    }

    const users = dbClient.db.collection("users");
    users.findOne({ email }, (err, user) => {
      if (user) {
        response.status(400).json({ error: "Already exist" });
      } else {
        const hashed_password = sha1(password);
        users
          .insertOne({
            email,
            password: hashed_password,
          })
          .then((result) => {
            
            userQueue.add({
              userId: result.insertedId,
            });

            response.status(201).json({
              id: result.insertedId,
              email,
            });
          })
          .catch((err) => {
            console.log(err);
          });
      }
    });
  }

  static async getMe(request, response) {
    const token = request.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (userId) {
      const users = dbClient.db.collection("users");
      const idObject = new ObjectID(userId);
      users.findOne({ _id: idObject }, (err, user) => {
        if (user) {
          response.status(200).json({ id: userId, email: user.email });
        } else {
          response.status(401).json({ error: "Unauthorized" });
        }
      });
    } else {
      response.status(401).json({ error: "Unauthorized" });
    }
  }
}

module.exports = UsersController;
