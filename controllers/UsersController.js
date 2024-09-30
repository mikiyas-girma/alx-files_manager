import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import sha1 from "sha1";

class UsersController {
  static postNew(request, response) {
    const { email, password } = request.body

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
}

module.exports = UsersController
