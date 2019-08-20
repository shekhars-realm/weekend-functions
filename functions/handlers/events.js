const {db, admin} = require('../utils/admin')
const geoFireX = require('geofirex');
const geo = geoFireX.init(admin)
const {GeoCollectionReference, GeoFirestore, GeoQuery, GeoQuerySnapshot} = require('geofirestore');
const geofirestore = new GeoFirestore(db)
const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs')
const { validateNewEvent, validateJoinEvent, validateRating } = require('../utils/validators')
const moment = require('moment');

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
    status: 'upcoming'
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
    db.doc(`/ratings/${doc.id}`).set({
      ratings: [],
      user: req.user.handle
    });
    return db.doc(`/locations/${doc.id}`).set({
      g: newEvent.geoHash,
      l: newEvent.geoPoint,
      data: resEvent
    })
  }).then((doc) => {
    const eventDoc={
      eventId: newEvent.eventId,
      startTime: newEvent.startTime,
      name: newEvent.name,
      endTime: newEvent.endTime
    }
    return db.collection('users').doc(`${req.user.handle}`).update({
            schedule: admin.firestore.FieldValue.arrayUnion({...eventDoc})
          })
  }).then(data => {
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
      const {valid, errors} = validateJoinEvent(req, {
        startTime: doc.data().startTime,
        endTime: doc.data().endTime
      })

      if(!valid) return res.status(405).json({
        errors: 'Clear your schedule for this time!'
      })
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
            userImage: req.user.imgUrl
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
  const eventDoc = {};
  db.doc(`/events/${req.params.eventId}`).get().then((doc) => {
    if(doc.exists){

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

exports.deleteEvent = (req, res) => {
  let batch = db.batch();
  let event = {}
  db.collection('events').doc(`${req.params.eventId}`).get().then(doc => {
    if(doc.exists) {
      console.log('event doc: ', doc.data());
      event = doc.data()
      batch.update(db.doc(`/users/${doc.data().user}`), {
        schedule: admin.firestore.FieldValue.arrayRemove({
          endTime: doc.data().endTime,
          startTime: doc.data().startTime,
          name: doc.data().name,
          eventId: doc.id
        })
      })
      console.log('after delete user: ', batch);
      if(doc.data().participants.length > 0) {
        console.log('creating participant batch');
        doc.data().participants.forEach(participant => {
          let docRef = db.doc(`/users/${participant.user}`)
          batch.update(docRef, {
            schedule: admin.firestore.FieldValue.arrayRemove({
              endTime: doc.data().endTime,
              startTime: doc.data().startTime,
              name: doc.data().name,
              eventId: doc.id
            })
          })
        })
      }
      batch.delete(db.doc(`/events/${doc.id}`))
      batch.delete(db.doc(`/locations/${doc.id}`))
      console.log('batched: ', batch);
      return db.collection('forum').where('eventId', '==', doc.id).get()
    } else {
      return res.status(404).json({
        error: 'Event not found!'
      })
    }
  }).then(data => {
    console.log('forum data: ', data);
    data.forEach(doc => {
      let forumRef = db.doc(`/forum/${doc.id}`)
      batch.delete(forumRef)
    })
    return batch.commit()
  }).then(result => {
    console.log('success in deleting event!');
    return res.json({message: 'Event deleted'})
  }).catch(err => {
    console.log('in event delete: ', err);
    return res.json({error: err.code})
  })
}

exports.getEvent = (req, res) => {
  db.collection('events').doc(`${req.params.eventId}`).get().then((doc) => {
    if(doc.exists) {
      const event = doc.data()
      event.eventId = doc.id;
      event.participants.forEach(participant => {
        if(participant.user === req.user.handle) {
          event.joined = true
        } else {
          event.joined = false
        }
      })
      return res.json({event})
    } else {
      return res.status(400).json({error: 'Event not found'});
    }
  }).catch((err) => {
    return res.status(500).json({error: err.code})
  })
}

exports.getUserEvent = (req, res) => {
  db.collection('events').where('user', '==', req.params.handle).orderBy('createdAt', 'desc')
  .get().then((data) => {
    let events = []
    data.forEach(doc => {
      events.push(doc.data())
    })
    return res.json({events})
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

exports.rateEvent = (req, res) => {
  let rating = validateRating(req);
  return db.doc(`/ratings/${req.body.eventId}`).update({
    ratings: admin.firestore.FieldValue.arrayUnion(rating)
  }).then(result => {
    return db.collection('notifications').doc(`${req.body.notificationId}`).delete()
  }).then(result => {
    return res.json({message: 'Your feedback has been noted!'})
  }).catch(err => {
    console.log(err);
    return res.status(500).json({error: err.code});
  })
}

exports.changeParticipantStatus = (req, res) => {
 let eventDoc = {};
 let batch = db.batch();
 db.collection('events').doc(`${req.body.eventId}`).get().then(doc => {
   if(doc.exists) {
     eventDoc = doc.data();
     let changeEventStatus = eventDoc.participants.length > 0 && eventDoc.participants.every(participant => {
       return participant.status !== undefined
     })
     let eventRef = db.collection('events').doc(`${doc.id}`);
     batch.update(eventRef, {
       participants: admin.firestore.FieldValue.arrayRemove({
         user: req.body.user,
         userImage: req.body.userImage
       })
     })
     batch.update(eventRef, {
       participants: admin.firestore.FieldValue.arrayUnion({
         user: req.body.user,
         userImage: req.body.userImage,
         status: req.body.status
       })
     })
     let notiRef = db.collection('notifications').doc();
     let notiObj = {
       createdAt: new Date().toISOString(),
       recipient: req.body.user,
       sender: eventDoc.user,
       senderImage: eventDoc.userImage,
       read: false,
       startTime: eventDoc.startTime,
       eventName: eventDoc.name,
       eventId: doc.id,
       type: req.body.status === 'absent' ? 'markedAsAbsent' : 'markedAsPresent'
     }
     batch.set(notiRef, notiObj);
     return batch.commit();
   } else {
     return res.status(400).json({error: 'Event not found!'})
   }
 }).then(result => {
   return res.json({message: 'Participant notified'})
 }).catch(err => {
   console.log(err);
   return res.status(500).json({error: err.code});
 })
}
