const functions = require('firebase-functions');

const app = require('express')();

const {
  db,
  admin
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


exports.onUserImageChange = functions.region('europe-west2').firestore.document('/users/{userId}').onUpdate(change => {
  if(change.before.data().imageUrl !== change.after.data().imageUrl) {
    let batch = db.batch();
    let docRef;
    change.after.data().schedule.length > 0 && change.after.data().schedule.map(event => {
      docRef = db.doc(`/events/${event.eventId}`);
      if(Object.keys(event).length > 0) {
        batch.update(docRef, {
            participants: admin.firestore.FieldValue.arrayRemove({
              user: change.before.data().handle,
              userImage: change.before.data().imageUrl,
            })
          })
      }
      })
    return batch.commit().then(res => {
      batch = db.batch();
      change.after.data().schedule.length > 0 && change.after.data().schedule.map(event => {
        if(Object.keys(event).length > 0) {
          docRef = db.doc(`/events/${event.eventId}`);
          batch.update(docRef, {
              participants: admin.firestore.FieldValue.arrayUnion({
                user: change.after.data().handle,
                userImage: change.after.data().imageUrl,
              })
            })
        }
        })
        return db.collection('forum').where('user', '==', `${change.before.data().handle}`).get()
    }).then(data => {
      data.forEach(doc => {
        let docRef = db.doc(`/forum/${doc.id}`);
        batch.update(docRef, {
          userImage: change.after.data().imageUrl
        })
      })
      return db.collection('replies').where('user', '==', `${change.before.data().handle}`).get()
    }).then(data => {
      data.forEach(doc => {
        let docRef = db.doc(`/replies/${doc.id}`);
        batch.update(docRef, {
          userImage: change.after.data().imageUrl
        })
      })
      console.log('success');
      batch.commit();
    }).catch(err => {
      console.log('errr--', err);
    })
  }
})

exports.createNotificationOnForumPost = functions.region('europe-west2').firestore.document('forum/{id}')
.onCreate(snapshot => {
  return db.doc(`/events/${snapshot.data().eventId}`).get().then(doc => {
    if(doc.exists && doc.data().user !== snapshot.data().user) {
      return db.doc(`/notifications/${snapshot.id}`).set({
        createdAt: new Date().toISOString(),
        recipient: doc.data().user,
        sender: snapshot.data().user,
        senderImage: snapshot.data().userImage,
        read: false,
        type: 'forumPost',
        forumId: doc.id
      })
    }
  }).catch(err => {
    console.log('notification on forum post error: ',err);
  })
})

exports.createNotificationOnForumReply = functions.region('europe-west2').firestore.document('replies/{id}')
.onCreate(snapshot => {
  return db.doc(`/forum/${snapshot.data().forumId}`).get().then(doc => {
    if(doc.exists && doc.data().user !== snapshot.data().user) {
      return db.doc(`/notifications/${snapshot.id}`).set({
        createdAt: new Date().toISOString(),
        recipient: doc.data().user,
        sender: snapshot.data().user,
        senderImage: snapshot.data().userImage,
        read: false,
        type: 'forumReply',
        forumId: doc.id
      })
    }
  }).catch(err => {
    console.log('notification on forum reply error: ',err);
  })
})
