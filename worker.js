import Queue from "bull";
import imgThumbnail from "image-thumbnail";
import { promises as fs } from "fs";
import dbClient from "./utils/db";
import { ObjectID } from "mongodb";
import { writeFile } from "fs";
import { promisify } from "util";

const writeFileAsync = promisify(writeFile);

const fileQueue = new Queue('fileQueue', {
    redis: {
      host: 'localhost',
      port: 6379,
    }
  });

const userQueue = new Queue('userQueue', {
    redis: {
      host: 'localhost',
      port: 6379,
    }
  });

const generateThumbnail = async (filePath, size) => {
  try {
    const thumbnail = await imgThumbnail(filePath, {
      width: size,
      responseType: "buffer",
    });

    const thumbnailPath = `${filePath}_${size}`;
    await writeFileAsync(thumbnailPath, thumbnail);
    return thumbnailPath;
  } catch (error) {
    console.error(`Error generating ${size}px thumbnail:`, error);
    throw error;
  }
};

// const fileQueue = new Queue("fileQueue");

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error("Missing fileId");
  }
  if (!userId) {
    throw new Error("Missing userId");
  }

  try {
    const files = dbClient.db.collection("files");
    const file = await files.findOne({
      _id: ObjectID(fileId),
      userId: ObjectID(userId),
    });

    if (!file) {
      throw new Error("File not found");
    }

    const thumbnailSizes = [100, 250, 500];
    const thumbnailPaths = {};

    for (const size of thumbnailSizes) {
      const thumbnailPath = await generateThumbnail(file.localPath, size);
      thumbnailPaths[size] = thumbnailPath;
    }

    await files.updateOne(
      { _id: ObjectID(fileId) },
      { $set: { thumbnails: thumbnailPaths } }
    );

    return { status: "success", thumbnail: thumbnailPaths };
  } catch (error) {
    console.log("Thumbnail generation failed", error);
    throw error;
  }
});


userQueue.process(async (job) => {
    const { userId } = job.data;
    
    if (!userId) {
        throw new Error("Missing userId");
    }
    
    try {
        const users = dbClient.db.collection("users");
        const user = await users.findOne({ _id: ObjectID(userId) });
    
        if (!user) {
        throw new Error("User not found");
        }
        // todo: send welcome email using sendgrid or mailgun or whatever
        console.log(`Welcome email sent to ${user.email}`);
        return { status: "success" };
    } catch (error) {
        console.log("User not found", error);
        throw error;
    }
    });
