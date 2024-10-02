import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { ObjectID } from "mongodb";
import { promises as fs } from "fs";
import mime from "mime-types";
import Queue from "bull";

// Add the Bull queue initialization
const fileQueue = new Queue("fileQueue", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

class FilesController {
  static async getUser(request) {
    const token = request.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (userId) {
      const users = dbClient.db.collection("users");
      const idObject = new ObjectID(userId);
      const user = await users.findOne({ _id: idObject });

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
      const file = await files.findOne({ _id: idObject, userId: user._id });

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

      try {
        const result = await files.insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileName,
        });

        if (type.startsWith("image")) {
          await fileQueue.add({
            userId: user._id,
            fileId: result.insertedId.toString(),
          });
        }

        return response.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
      } catch (error) {
        console.log(error);
        return response.status(500).json({ error: "Internal Server Error" });
      }
    }
    return null;
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }
    const fileId = request.params.id;
    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject, userId: user._id });
    if (!file) {
      return response.status(404).json({ error: "Not found" });
    }
    return response.status(200).json(file);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }
    const { parentId, page } = request.query;
    const pageNum = page || 0;
    const files = dbClient.db.collection("files");
    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files
      .aggregate([
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [
              { $count: "total" },
              { $addFields: { page: parseInt(pageNum, 10) } },
            ],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ])
      .toArray((err, result) => {
        if (result) {
          const final = result[0].data.map((file) => {
            const tmpFile = {
              ...file,
              id: file._id,
            };
            delete tmpFile._id;
            delete tmpFile.localPath;
            return tmpFile;
          });

          return response.status(200).json(final);
        }

        return response.status(404).json({ error: "Not found" });
      });
    return null;
  }

  static async putPublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }
    const { id } = request.params;
    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(id);
    const publish = { $set: { isPublic: true } };
    const options = { returnOriginal: false };

    files.findOneAndUpdate(
      { _id: idObject, userId: user._id },
      publish,
      options,
      (err, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          return response.status(404).json({ error: "Not found" });
        }
        return response.status(200).json(file.value);
      }
    );

    return null;
  }

  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }
    const { id } = request.params;
    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(id);
    const publish = { $set: { isPublic: false } };
    const options = { returnOriginal: false };

    files.findOneAndUpdate(
      { _id: idObject, userId: user._id },
      publish,
      options,
      (err, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          return response.status(404).json({ error: "Not found" });
        }
        return response.status(200).json(file.value);
      }
    );

    return null;
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const size = request.query.size;

    if (size && !["100", "250", "500"].includes(size)) {
      return response.status(400).json({ error: "Invalid size parameter" });
    }

    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(id);

    files.findOne({ _id: idObject }, async (err, file) => {
      if (!file) {
        return response.status(404).json({ error: "Not found" });
      }
      if (file.isPublic) {
        if (file.type === "folder") {
          return response
            .status(400)
            .json({ error: "A folder doesn't have content" });
        }

        try {
          let fileName = file.localPath;
          //   console.log("public filename: ". fileName)
          const data = await fs.readFile(fileName);
          //   console.log("public data: ", data)
          const contentType = mime.contentType(file.name);
          //   console.log("public contentType: ", contentType)
          return response
            .header("Content-Type", contentType)
            .status(200)
            .send(data);
        } catch (error) {
          return response.status(404).json({ error: "Not found" });
        }
      } else {
        const user = await FilesController.getUser(request);
        if (!user) {
          return response.status(404).json({ error: "Not found" });
        }

        if (file.userId.toString() === user._id.toString()) {
          if (file.type === "folder") {
            return response
              .status(400)
              .json({ error: "A folder doesn't have content" });
          }

          try {
            let fileName = file.localPath;

            if (size && file.type.startsWith("image")) {
              fileName = `${fileName}_${size}`;
            }

            try {
                const contentType = mime.contentType(file.name);
                if (!contentType) {
                    return response.status(400).json({ error: "Invalid file type" });
                }
              const data = await fs.promises.readFile(fileName);
              return response
                .header("Content-Type", contentType)
                .status(200)
                .send(data);
            } catch (error) {
              // thumbnail doesn't exist return 404
              return response.status(404).json({ error: "Not found" });
            }
          } catch (error) {
            return response.status(404).json({ error: "Not found" });
          }
        } else {
          return response.status(404).json({ error: "Not found" });
        }
      }
    });
  }
}

module.exports = FilesController;
