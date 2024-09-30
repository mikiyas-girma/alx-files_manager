import { MongoClient } from "mongodb";

const HOST = process.env.DB_HOST || "localhost";
const PORT = process.env.DB_PORT || 27017;
const DB = process.env.DB_DATABASE || "files_manager";

const url = `mongodb://${HOST}:${PORT}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });

    this.client
      .connect()
      .then(() => {
        this.db = this.client.db(`${DB}`);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  isAlive() {
    return this.client.isConnected();
  }
  
  async nbUsers() {
    const users = this.db.collection("users");
    const tot_users = await users.countDocuments();
    return tot_users;
  }

  async nbFiles() {
    const files = this.db.collection("files");
    const tot_files = await files.countDocuments();
    return tot_files;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
