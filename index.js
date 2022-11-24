const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongodb
const uri = `mongodb+srv://${process.env.SM_USER}:${process.env.SM_PASS}@cluster0.9b1wrmq.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const categoryCollection = client.db("soundsMart").collection("category");

        // data load from mongodb
        app.get("/category", async (req, res) => {
        const query = {};
        const categoryName = await categoryCollection.find(query).toArray();
        res.send(categoryName);
        });
        
  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("welcome to Sounds Mart");
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
