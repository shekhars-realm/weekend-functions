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
    g: geo.point(req.body.location.lat, req.body.location.lng).hash,
    l: new admin.firestore.GeoPoint(req.body.location.lat, req.body.location.lng),
    headCount: req.body.headCount,
    tags: req.body.tags,
    user: req.user.handle,
    userImage: req.user.imgUrl,
    startTime: req.body.startTime,
    createdAt: new Date().toISOString(),
  }

  db.collection('events').add(newEvent).then((doc) => {
    const resEvent = {};
    resEvent.name = req.body.name;
    resEvent.startTime = req.body.startTime;
    return db.doc(`/locations/${doc.id}`).set({
      g: newEvent.g,
      l: newEvent.l,
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
