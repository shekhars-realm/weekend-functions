const {db, admin} = require('../utils/admin')
const geoFireX = require('geoFireX');
const geo = geoFireX.init(admin)
const {GeoCollectionReference, GeoFirestore, GeoQuery, GeoQuerySnapshot} = require('geofirestore');
const geofirestore = new GeoFirestore(db)

exports.getAllEventsByLocation = (req, res) => {
  geofirestore.collection('locations').near({ center: new admin.firestore.GeoPoint(req.body.location.lat, req.body.location.lng), radius: req.body.radius }).get().then(data => {
    let events = []
    data.forEach(doc => {
      events.push({
        eventId: doc.id,
        name: doc.data().data.name,
        startTime: doc.data().data.startTime,
        geoHash: doc.data().g,
        geoPoint: doc.data().l
      })
    })
    return res.json(events);
  }).catch((err) => {
    console.log(err);
  })
}

exports.postEvent = (req, res) => {

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
    const resEvent = {};
    resEvent.name = req.body.name;
    resEvent.startTime = req.body.startTime;
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
