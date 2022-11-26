const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
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

// middleware for verify jwt 
function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send('unauthorized access');
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN,function(err,decoded){
    if(err){
      return res.status(403).send({message: "forbidden access"})
    }
    req.decoded = decoded;
    next();
  })
}

async function run() {
  try {
    const categoryCollection = client.db("soundsMart").collection("category");
    const productCollection = client.db("soundsMart").collection("products");
    const bookingsCollection = client.db("soundsMart").collection("booking");
    const userCollection = client.db("soundsMart").collection("user");

        // category name load from db
        app.get("/category", async (req, res) => {
        const query = {};
        const categoryName = await categoryCollection.find(query).toArray();
        res.send(categoryName);
        });

        // product load from db
        app.get("/products", async (req, res) => {
        const query = {};
        const products = await productCollection.find(query).toArray();
        res.send(products);
        });

        app.get('/products/:id', async(req,res)=>{
          const id = req.params.id;
          const query = { _id: ObjectId(id)};
          const product = await productCollection.findOne(query);
          res.send(product);
        })

        app.get('/bookings',verifyJWT, async(req, res)=>{
          const email = req.query.email;
          const decodedEmail = req.decoded.email;
          if(email !== decodedEmail){
            return res.status(403).send({message: 'forbidden access'});
          }
          const query = {email: email};
          const bookings = await bookingsCollection.find(query).toArray();
          res.send(bookings);
        })

        app.post('/bookings', async(req, res)=>{
          const booking = req.body;
          console.log(booking);
          const result = await bookingsCollection.insertOne(booking);
          res.send(result);
       });

        app.get('/jwt', async (req, res)=>{
          const email = req.query.email;
          const query = {email: email};
          const user = await userCollection.findOne(query);
          if(user){
            const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '10h'});
            return res.send({accessToken: token});
          }
          res.status(403).send({accessToken: ''});
        })

        app.post('/users', async (req, res)=>{
          const user = req.body;
          console.log(user);
          const result = await userCollection.insertOne(user);
          res.send(result);
        })

        



        
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
