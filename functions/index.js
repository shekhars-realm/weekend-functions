const functions = require('firebase-functions');

const app = require('express')();

const {
  db
} = require('./utils/admin')

const FBAuth = require('./utils/fbAuth')

const cors = require('cors');
app.use(cors());

const {
  getAllEventsByLocation,
  getEvent,
  getUserEvent,
  postEvent,
  joinEvent,
  leaveEvent,
  deleteEvent
} = require('./handlers/events');
const {
  addToForum,
  deleteForumPost,
  replyForumPost,
  getForums,
  postReply,
  getForumDetails,
} = require('./handlers/forums');
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationRead
} = require('./handlers/users');

//event routes
app.post('/events', getAllEventsByLocation);
app.post('/event', FBAuth, postEvent);
app.get('/event/:eventId', FBAuth, getEvent);
app.get('/events/:handle', FBAuth, getUserEvent);
app.get('/event/:eventId/join', FBAuth, joinEvent);
app.get('/event/:eventId/leave', FBAuth, leaveEvent);
app.get('/event/:eventId/delete', FBAuth, deleteEvent);

//forum routes
app.post('/forums/add', FBAuth, addToForum);
app.get('/forums/:eventId', FBAuth, getForums);
app.post('/reply/add', FBAuth, postReply);
app.get('/forum/:forumId', FBAuth, getForumDetails);
//app.post('/forum/reply/:forumId', FBAuth, replyForumPost);
//app.delete('/forum/:postId', FBAuth, deleteForumPost)

//user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationRead)

exports.api = functions.region('europe-west2').https.onRequest(app);
