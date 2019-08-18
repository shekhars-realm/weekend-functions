const {db, admin} = require('../utils/admin')

const firebaseConfig = require('../utils/config')

const firebase = require('firebase')
firebase.initializeApp(firebaseConfig)

const { validateSignUpData, validateLogInData, reduceUserDetails } = require('../utils/validators')

exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle.toLowerCase()
  };

  const {valid, errors} = validateSignUpData(newUser)

  if(!valid) return res.status(400).json(errors)

  const noImg = 'no-img.png'

  let token, user;
  db.doc(`/users/${newUser.handle}`).get()
  .then((doc) => {
    if(doc.exists) {
      return res.status(400).json({handle: 'this handle is already taken'})
    } else {
      return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
    }
  })
  .then((data) => {
    userId = data.user.uid
    return data.user.getIdToken();
  })
  .then((userToken) => {
    token = userToken
    const userCredentials = {
      handle: newUser.handle,
      email: newUser.email,
      schedule: [],
      createdAt: new Date().toISOString(),
      imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${noImg}?alt=media`,
      userId
    }
    return db.doc(`/users/${newUser.handle}`).set(userCredentials)
  })
  .then((data) => {
    return res.status(201).json({token: token})
  })
  .catch((err) => {
    if(err.code === 'auth/email-already-in-use') {
      return res.status(400).json({email: 'Email already in use'})
    } else {
      return res.status(500).json({general: 'Something went wrong! Please try again.'})
    }
  })
}

exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  }

  const {valid, errors} = validateLogInData(user)
  if(!valid) return res.status(400).json(errors)

  firebase.auth().signInWithEmailAndPassword(user.email, user.password)
  .then((data) => {
    return data.user.getIdToken()
  })
  .then((token) => {
    return res.status(200).json({token})
  })
  .catch((err) => {
    console.log(err);
      return res.status(403).json({general: 'Wrong credentials, Please try again!'})
  })

}

exports.getUserDetails = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.params.handle}`).get().then(doc => {
    if(doc.exists) {
      userData.credentials = doc.data();
    }
    console.log('userData: ', userData);
    return res.json(userData)
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code})
  })
}

exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);
  console.log(req.user.handle, userDetails);
  db.doc(`/users/${req.user.handle}`).update(userDetails)
  .then(() => {
    return res.json({message: 'Details added succesfully'});
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}

exports.uploadImage = (req, res) => {
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs')

  const busboy = new BusBoy({headers: req.headers});

  let imageFileName;
  let imageToBeUploaded;

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if(mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({error: 'Wrong file type submitted'})
    }
    const imageExtension = filename.split('.')[filename.split('.').length - 1];
    imageFileName = `${Math.round(Math.random()*1000000000)}.${imageExtension}`;
    const filePath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = {filePath, mimetype};
    file.pipe(fs.createWriteStream(filePath));
  });
  busboy.on('finish', () => {
    admin.storage().bucket().upload(imageToBeUploaded.filePath, {
      resumable: false,
      metadata: {
        metadata: {
          contentType: imageToBeUploaded.mimetype
        }
      }
    }).then(() => {
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
      return db.doc(`/users/${req.user.handle}`).update({imageUrl: imageUrl })
    }).then(() => {
      return res.json({message: 'Image uploaded successfully'})
    }).catch(err => {
      return res.status(500).json({error: err.code})
    })
  })
  busboy.end(req.rawBody);
}

exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.user.handle}`).get().then(doc => {
    if(doc.exists) {
      userData.credentials = doc.data();
    }
    return db.collection('notifications').where('recipient', '==', req.user.handle)
    .orderBy('createdAt', 'desc').limit(10).get();
  }).then(data => {
    userData.notifications = [];
    data.forEach(doc => {
      userData.notifications.push({
        recipient: doc.data().recipient,
        sender: doc.data().sender,
        shoutId: doc.data().shoutId,
        senderImage: doc.data().senderImage,
        createdAt: doc.data().createdAt,
        eventId: doc.data().eventId,
        forumId: doc.data().forumId,
        read: doc.data().read,
        type: doc.data().type,
        notificationId: doc.id,
        startTime: doc.data().startTime,
        eventName: doc.data().eventName
      })
    })
    console.log('userData: ', userData);
    return res.json(userData)
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code})
  })
}

exports.markNotificationRead = (req, res) => {
  let batch = db.batch();
  req.body.forEach(notificationId => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, {read: true});
  });
  batch.commit().then(() => {
    return res.json({message: 'Notifications marked as read'});
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}

exports.markNotificationRead = (req, res) => {
  let batch = db.batch();
  req.body.forEach(notificationId => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, {read: true});
  });
  batch.commit().then(() => {
    return res.json({message: 'Notifications marked as read'});
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}
