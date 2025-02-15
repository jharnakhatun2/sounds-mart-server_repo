const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['https://sounds-mart.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  credentials: true,
}));
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("welcome to Sounds Mart");
});

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
    const blogCollection = client.db("soundsMart").collection("blogs");
    const sellerProductCollection = client.db("soundsMart").collection("sellerProducts");
    const headphoneCollection = client.db("soundsMart").collection("headphoneProducts");
    const paymentsCollection = client.db("soundsMart").collection("payments");

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
        });

        app.get('/bookings/:id', async(req,res)=>{
          const id = req.params.id;
          const query = { _id: ObjectId(id)};
          const paybooking = await bookingsCollection.findOne(query);
          res.send(paybooking);
        });

        app.post('/bookings', async(req, res)=>{
          const booking = req.body;
          console.log(booking);
          const result = await bookingsCollection.insertOne(booking);
          res.send(result);
       });

      //  Stripe payment
      app.post("/create-payment-intent", async (req, res) => {
        const booking = req.body;
        const price = booking.price;
        const amount = price * 100;
      
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          "payment_method_types": [
            "card"
          ]
        });
      
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      });

        // save payment collections in db
        app.post('/payments', async (req, res)=>{
          const payment = req.body;
          const result = await paymentsCollection.insertOne(payment);
          const id = payment.bookingId;
          const filter = { _id: ObjectId(id)}
          const updateDoc = {
            $set: {
              paid: true,
              transactionId: payment.transactionId
            }
          }
          const updateResult = await bookingsCollection.updateOne(filter,updateDoc);
          res.send(result);
        })

        app.get('/jwt', async (req, res)=>{
          const email = req.query.email;
          const query = {email: email};
          const user = await userCollection.findOne(query);
          if(user){
            const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: "2 days"});
            return res.send({accessToken: token});
          }
          res.status(403).send({accessToken: ''});
        })

        app.get('/users', async (req, res)=>{
          const query = {};
          const allUsers = await userCollection.find(query).toArray();
          res.send(allUsers);
        });

        app.post('/users', async (req, res)=>{
          const user = req.body;
          console.log(user);
          const result = await userCollection.insertOne(user);
          res.send(result);
        });

        app.delete('/users/:id', async (req, res)=>{
          const id = req.params.id;
          const filter = {_id: ObjectId(id)};
          const result = await userCollection.deleteOne(filter);
          res.send(result);
        });
        
        // admin ki na check kora
        app.get('/users/admin/:email', async (req, res) => {
          const email = req.params.email;
          const query = {email}
          const user = await userCollection.findOne(query);
          res.send({isAdmin: user?.role === 'admin'});
        });

        //check as if seller
        app.get('users/seller/:email', async (req, res) => {
          const email = req.params.email;
          const query = {email}
          const user = await userCollection.findOne(query);
          res.send({isSeller : user?.users === 'seller'})
        });
        
        //check as if buyer
        app.get('users/buyer/:email', async (req, res) => {
          const email = req.params.email;
          const query = {email}
          const user = await userCollection.findOne(query);
          res.send({isBuyer : user?.users === 'buyer'})
        });
        
          // update user (create admin)
          app.put('/users/admin/:id', verifyJWT, async(req, res)=>{
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail};
            const user = await userCollection.findOne(query);
            if(user.role !== 'admin'){
              return res.status(403).send({message: 'forbidden access'})
            }
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const options = { upsert: true };
            const updateDoc = {
              $set:{
                role: 'admin'
              }
            }
            const result = await userCollection.updateOne(filter,updateDoc,options);
            res.send(result);
          });

          app.get('/sellerproduct', async (req, res) => {
            const query = {};
            const product = await sellerProductCollection.find(query).toArray();
            res.send(product);
          });

          app.post('/sellerproduct', async (req, res)=>{
            const product = req.body;
            const result = await sellerProductCollection.insertOne(product);
            res.send(result);
          });

          app.delete('/sellerproduct/:id', async (req, res)=>{
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const result = await sellerProductCollection.deleteOne(filter);
            res.send(result);
          });

          app.get('/blogs', async (req, res) => {
            const query = {};
            const blogs = await blogCollection.find(query).toArray();
            res.send(blogs);
          });

          app.get('/blogs/:id', async(req,res)=>{
            const id = req.params.id;
            const query = { _id: ObjectId(id)};
            const blog = await blogCollection.findOne(query);
            res.send(blog);
          });

          // headphone product api create
          app.get('/headphone', async (req, res) => {
            const query = {};
            const headphones = await headphoneCollection.find(query).toArray();
            res.send(headphones);
          });

          app.get('/headphone/:id', async(req,res)=>{
            const id = req.params.id;
            const query = { _id: ObjectId(id)};
            const headphone = await headphoneCollection.findOne(query);
            res.send(headphone);
          });

        
  } 
  finally {

  }
}
run().catch(console.log);



app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
