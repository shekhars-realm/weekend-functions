const functions = require('firebase-functions');

const app = require('express')();

const {db} = require('./utils/admin')

const FBAuth = require('./utils/fbAuth')

const cors = require('cors');
app.use(cors());

const {getAllEventsByLocation, postEvent} = require('./handlers/events');
const {signup, login, uploadImage, addUserDetails,getAuthenticatedUser, getUserDetails, markNotificationRead} = require('./handlers/users');

//shout routes
app.post('/events', getAllEventsByLocation);
app.post('/event', FBAuth, postEvent);

//user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user',FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationRead)

exports.api = functions.https.onRequest(app);
