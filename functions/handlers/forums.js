const {db, admin} = require('../utils/admin');

exports.addToForum = (req, res) => {
  const newPost = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    user: req.user.handle,
    userImage: req.user.imgUrl,
    eventId: req.body.eventId,
    replyCount: 0
  }
  db.collection('forum').add(newPost).then(doc => {
    return res.json({
      message: 'added to forums with document Id: '+doc.id
    })
  }).catch(err => {
    console.log(err);
    return res.status(500).json({
      error: err.code
    })
  })
}

exports.getForums = (req, res) => {
  db.collection('forum').where('eventId', '==', `${req.params.eventId}`).orderBy('createdAt', 'desc').get().then(data => {
    console.log(data);
    const forums = [];
    data.forEach(doc => {
      forums.push({
        forumId: doc.id,
        body: doc.data().body,
        user: doc.data().user,
        userImage: doc.data().userImage,
        createdAt: doc.data().createdAt,
        eventId: doc.data().eventId,
        replyCount: doc.data().replyCount
      })
    })
    return res.json({forums});
  }).catch(err => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}

exports.postReply = (req, res) => {
  const reply = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    user: req.user.handle,
    userImage: req.user.imgUrl,
    forumId: req.body.forumId
  }
  db.collection('replies').add(reply).then(doc => {
    return db.collection('forum').doc(`${req.body.forumId}`).update({
      replyCount: admin.firestore.FieldValue.increment(1)
    })
  }).then(doc => {
    return res.json({message: 'reply added successfully!'})
  }).catch(err => {
    console.log(err);
    return res.status(500).json({
      error: err.code
    })
  })
}

exports.getForumDetails = (req, res) => {
  const forum = {}
  db.collection('forum').doc(`${req.params.forumId}`).get().then(doc => {
    if(doc.exists) {
      forum.createdAt = doc.data().createdAt;
      forum.user = doc.data().user;
      forum.userImage = doc.data().userImage;
      forum.body = doc.data().body;
      forum.replyCount = doc.data().replyCount;
      return db.collection('replies').where('forumId', '==', `${req.params.forumId}`).orderBy('createdAt', 'desc').get()
    } else {
      return res.status(400).json({
        message: 'Forum not found'
      })
    }
  }).then(data => {
    const replies = []
    data.forEach(doc => {
      replies.push({
        ...doc.data()
      })
    })
    forum.replies = replies
    return res.json({forum})
  }).catch(err => {
    console.log(err);
    return res.status(500).json({
      error: err.code
    })
  })
}
