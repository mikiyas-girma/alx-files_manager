import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { ObjectID } from "mongodb";
import { promises as fs } from "fs";

class FilesController {
  static async getUser(request) {
    const token = request.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (userId) {
      const users = dbClient.db.collection("users");
      const idObject = new ObjectID(userId);
      const user = users.findOne({ _id: idObject });

      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }

    const { name, type, parentId } = request.body;
    const isPublic = request.body.isPublic || false;
    const { data } = request.body;

    if (!name) {
      return response.status(400).json({ error: "Missing name" });
    }
    if (!type) {
      return response.status(400).json({ error: "Missing type" });
    }
    if (type !== "folder" && !data) {
      return response.status(400).json({ error: "Missing Data" });
    }

    const files = dbClient.db.collection("files");
    if (parentId) {
      const idObject = new ObjectID(parentId);
      const file = files.findOne({ _id: idObject, userId: user._id });

      if (!file) {
        return response.status(400).json({ error: "Parent not found" });
      }
      if (file.type !== "folder") {
        return response.status(400).json({ error: "Parent is not a folder" });
      }
    }
    if (type === "folder") {
      files
        .insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        })
        .then((result) =>
          response.status(201).json({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          })
        )
        .catch((error) => {
          console.log(error);
        });
    } else {
      const filePath = process.env.FOLDER_PATH || "/tmp/files_manager";
      const fileName = `${filePath}/${uuidv4()}`;
      const buff = Buffer.from(data, "base64");

      try {
        try {
          await fs.mkdir(filePath);
        } catch (error) {
          console.log(error);
        }
        await fs.writeFile(fileName, buff, "utf-8");
      } catch (error) {
        console.log(error);
      }

      files
        .insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileName,
        })
        .then((result) => {
          response.status(201).json({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          });
        })
        .catch((error) => {
          console.log(error);
        });
    }
    return null;
  }
}

module.exports = FilesController;
