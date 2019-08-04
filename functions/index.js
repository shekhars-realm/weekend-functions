const functions = require('firebase-functions');

const app = require('express')();

const {db} = require('./utils/admin')

const FBAuth = require('./utils/fbAuth')

const cors = require('cors');
app.use(cors());

const {getAllEventsByLocation, getEvent, getUserEvent, postEvent, joinEvent, leaveEvent} = require('./handlers/events');
const {signup, login, uploadImage, addUserDetails,getAuthenticatedUser, getUserDetails, markNotificationRead} = require('./handlers/users');

//shout routes
app.post('/events', getAllEventsByLocation);
app.post('/event', FBAuth, postEvent);
app.get('/event/:eventId', getEvent);
app.get('/events/:handle', getUserEvent);
app.get('/event/:eventId/join', FBAuth, joinEvent);
app.get('/event/:eventId/leave', FBAuth, leaveEvent);

//user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user',FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationRead)

exports.api = functions.region('europe-west2').https.onRequest(app);
