const {db, admin} = require('../utils/admin')
const geoFireX = require('geofirex');
const geo = geoFireX.init(admin)
const {GeoCollectionReference, GeoFirestore, GeoQuery, GeoQuerySnapshot} = require('geofirestore');
const geofirestore = new GeoFirestore(db)
const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs')
const { validateNewEvent } = require('../utils/validators')

exports.getAllEventsByLocation = (req, res) => {

  const filter = validateFilters(req);
  console.log(filter);
  const query = geofirestore.collection('locations')
    .near({
      center: new admin.firestore.GeoPoint(filter.location.lat, filter.location.lng),
      radius: filter.radius
    })

  query.get().then(data => {
    const events = []
     data.forEach(doc => {
      if(doc.data().data.startTime >= filter.startTime) {
        if(filter.searchText) {
          if(doc.data().data.name.includes(filter.searchText) || doc.data().data.description.includes(filter.searchText)) {
            events.push({
              eventId: doc.id,
              name: doc.data().data.name,
              startTime: doc.data().data.startTime,
              endTime: doc.data().data.endTime,
              description: doc.data().data.description,
              primaryTag: doc.data().data.primaryTag,
              geoHash: doc.data().g,
              geoPoint: doc.data().l
            })
          }
        } else {
          events.push({
            eventId: doc.id,
            name: doc.data().data.name,
            startTime: doc.data().data.startTime,
            endTime: doc.data().data.endTime,
            description: doc.data().data.description,
            primaryTag: doc.data().data.primaryTag,
            geoHash: doc.data().g,
            geoPoint: doc.data().l
          })
        }
      }
    })
      return res.json(events);
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code})
  })
}

exports.postEvent = (req, res) => {

  const {valid, errors} = validateNewEvent(req)

  if(!valid) return res.status(400).json(errors)

  const newEvent = {
    name: req.body.name,
    description: req.body.description,
    geoHash: geo.point(req.body.location.lat, req.body.location.lng).hash,
    geoPoint: new admin.firestore.GeoPoint(req.body.location.lat, req.body.location.lng),
    headCount: req.body.headCount,
    tags: req.body.tags,
    user: req.user.handle,
    userImage: req.user.imgUrl,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    participants: [],
    createdAt: new Date().toISOString(),
  }



  db.collection('events').add(newEvent).then((doc) => {
    const resEvent = {
      name: req.body.name,
      description: req.body.description,
      primaryTag: req.body.tags[0],
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    };
    newEvent.eventId = doc.id;
    return db.doc(`/locations/${doc.id}`).set({
      g: newEvent.geoHash,
      l: newEvent.geoPoint,
      data: resEvent
    })
  }).then((doc) => {
    return res.json(newEvent)
  })
  .catch((err) => {
    console.log(err);
    return res.status(500).json({error: 'something went wrong'})
  })
}

exports.joinEvent = (req, res) => {
  const eventDoc = {}
  db.doc(`/events/${req.params.eventId}`).get().then((doc) => {
    if(doc.exists){
      eventDoc.startTime = doc.data().startTime;
      eventDoc.endTime = doc.data().endTime;
      eventDoc.name = doc.data().name;
      eventDoc.eventId = doc.id;
      if(doc.data().participants.length > 0) {
        doc.data().participants.forEach(participant => {
          if(participant.user === req.user.handle) {
            return res.status(400).json({error: 'Event already added to schedule!'});
          }
        })
      }
      return db.collection('events').doc(`${req.params.eventId}`).update({
          participants: admin.firestore.FieldValue.arrayUnion({
            user: req.user.handle,
            userImage: req.user.imgUrl,
          })
        })
    } else {
      return res.status(404).json({error: 'Event not found'});
    }
  }).then((doc) => {
      return db.collection('users').doc(`${req.user.handle}`).update({
          schedule: admin.firestore.FieldValue.arrayUnion({...eventDoc})
        })
  }).then((data) => {
    return res.json({message: 'Event added to schedule!'});
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}

exports.leaveEvent = (req, res) => {
  db.doc(`/events/${req.params.eventId}`).get().then((doc) => {
    if(doc.exists){
      const eventDoc = {};
      eventDoc.startTime = doc.data().startTime;
      eventDoc.endTime = doc.data().endTime;
      eventDoc.name = doc.data().name;
      eventDoc.eventId = doc.id;
      return db.collection('events').doc(`${req.params.eventId}`).update({
          participants: admin.firestore.FieldValue.arrayRemove({
            user: req.user.handle,
            userImage: req.user.imgUrl,
          })
        })
    } else {
      return res.status(404).json({error: 'Event not found'});
    }
  }).then((doc) => {
      return db.collection('users').doc(`${req.user.handle}`).update({
          schedule: admin.firestore.FieldValue.arrayRemove({...eventDoc})
        })
  }).then((data) => {
    return res.json({message: 'Event removed from schedule!'})
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}

exports.uploadEventImage = (req, res) => {

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
