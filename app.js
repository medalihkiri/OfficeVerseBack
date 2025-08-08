const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const session = require('express-session');

app.use(session({
  secret: 'secret_key', // use a strong secret in production
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set secure: true if using HTTPS
}));


require('dotenv/config');

const authJwt = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');

const trelloAuthRoute = require('./routes/trelloAuth');

app.use(cors()); //! ahaya fazet il cors
app.options('*',cors());

// Middlewares
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
app.use(morgan('tiny'));
// app.use(authJwt());
// app.use('/public/uploads', express.static( __dirname + '/public/uploads'));
app.use(errorHandler);

const api = process.env.API_URL;
//const categoriesRoute = require('./routes/categories');
const userRoute = require('./routes/users');
const roomRoutes = require('./routes/roomRoutes'); // Adjust path as needed
//const mapRoute = require('./routes/mapController');

// Routes
// localhost:3000/api/categories fil postman 
//app.use(`${api}/categories`, categoriesRoute);
app.use(`${api}/users`, userRoute);
//app.use(`${api}/map`, mapRoute);
app.use(`${api}/rooms`, roomRoutes);

app.use(`${api}/users`, trelloAuthRoute);
const dbConfig = require('./config/database.config.js');

mongoose.Promise = global.Promise;

// Connecting to the database
mongoose.connect(dbConfig.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    //useFindAndModify: false

}).then(() => {
    console.log("Successfully connected to the database");
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});
/*
app.get(`${api}/users/ping`, (req, res) => {
    res.status(200).send({ message: "API is alive" });
});*/



// listen for requests
app.listen(3000, () => {
    console.log("Server is listening on port "+api+" 3000");
});



