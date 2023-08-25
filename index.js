const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const client = new MongoClient(
  `mongodb+srv://${process.env.BUCKET_NAME}:${process.env.BUCKET_PASS}@cluster0.mnvzcly.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  }
);

const SUCCESS_MESSAGE = { success: true };

async function run() {
  try {
    app.get("/", (req, res) => res.send("Chat Ripple server is running"));
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    const userCollection = client.db("chatRipple").collection("users");

    app.post("/users", async (req, res) => {
      const data = req.body;
      const matched = await userCollection.findOne({ uid: { $eq: data.uid } });
      if (!matched) {
        const result = await userCollection.insertOne(data);
        result.insertedId && res.send(SUCCESS_MESSAGE);
      } else {
        res.send(SUCCESS_MESSAGE);
      }
    });

    app.get("/user-profile/:uid", async (req, res) => {
      const results = await userCollection.findOne({
        uid: { $eq: req.params.uid },
      });
      res.send(results);
    });

    app.get("/suggest-friends/:uid", async (req, res) => {
      const matched = await userCollection.findOne({
        uid: { $eq: req.params.uid },
      });
      const results = await userCollection
        .find({
          $and: [
            { uid: { $ne: req.params.uid } },
            { my_friends: { $nin: [req.params.uid] } },
            { uid: { $nin: matched.send_request } },
          ],
        })
        .toArray();
      res.send(results);
    });

    app.patch("/suggest-friends", async (req, res) => {
      const { sid, rid } = req.query;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(rid) },
        {
          $push: { send_request: sid },
        }
      );
      result.modifiedCount && res.send(SUCCESS_MESSAGE);
    });

    app.delete("/suggest-friends", async (req, res) => {
      const { sid, rid } = req.query;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(rid) },
        {
          $pull: { send_request: sid },
        }
      );
      result.modifiedCount && res.send(SUCCESS_MESSAGE);
    });

    app.get("/request-friends/:uid", async (req, res) => {
      const matched = await userCollection.findOne({
        uid: { $eq: req.params.uid },
      });
      if (matched?.send_request) {
        const results = await userCollection
          .find(
            { uid: { $in: matched.send_request } },
            {
              projection: {
                _id: 1,
                uid: 1,
                fullName: 1,
                email: 1,
                dp: 1,
                gender: 1,
              },
            }
          )
          .toArray();
        res.send(results);
      }
    });

    app.patch("/request-friends", async (req, res) => {
      const { sid, mid, rid } = req.query;
      await userCollection.updateOne(
        { _id: new ObjectId(mid) },
        { $push: { my_friends: sid } }
      );
      await userCollection.updateOne(
        { uid: sid },
        { $push: { my_friends: rid } }
      );
      await userCollection.updateOne(
        { uid: sid },
        { $pull: { send_request: rid } }
      );
      res.send(SUCCESS_MESSAGE);
    });

    app.delete("/request-friends", async (req, res) => {
      const { sid, mid, rid } = req.query;
      await userCollection.updateOne(
        { uid: sid },
        { $pull: { send_request: rid } }
      );
      await userCollection.updateOne(
        { _id: new ObjectId(mid) },
        { $pull: { send_request: sid } }
      );
      res.send(SUCCESS_MESSAGE);
    });

    app.get("/my-friends/:uid", async (req, res) => {
      const matched = await userCollection.findOne({
        uid: { $eq: req.params.uid },
      });
      if (matched?.my_friends) {
        const results = await userCollection
          .find({ uid: { $in: matched.my_friends } })
          .toArray();
        res.send(results);
      }
    });

    app.get("/message-profile/:uid", async (req, res) => {
      const result = await userCollection.findOne({ uid: req.params.uid });
      res.send(result);
    });

    app.post("/messenger", async (req, res) => {
      const data = req.body;
      const { sender, receiver } = data;
      await userCollection.updateOne(
        { uid: { $eq: receiver } },
        { $push: { [sender]: data[sender][0] } }
      );
      await userCollection.updateOne(
        { uid: { $eq: sender } },
        { $push: { [receiver]: data[sender][0] } }
      );
      res.send(SUCCESS_MESSAGE);
    });
  } finally {
    app.listen(port, () => console.log("Server is running port: ", port));
  }
}
run().catch(console.dir);
