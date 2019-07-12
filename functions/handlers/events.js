const {db, admin} = require('../utils/admin')
const geoFireX = require('geoFireX');
const geo = geoFireX.init(admin)
const events = geo.collection('events')
const point = geo.point( 49.445425, 7.741736)

exports.getAllEvents = (req, res) => {
  const center = geo.point(49.435198, 7.742410);
  const radius = 0.5;
  const field = 'location'
  console.log('data: ____________: ',   events.within(center, radius, field));

  db
  .collection('events')
  .orderBy('createdAt', 'desc')
  .get()
  .then((data) => {
    let events = []
    data.forEach(doc => {
      events.push({
        eventId: doc.id,
        description: doc.data().description,
        createdAt: doc.data().createdAt,
        location: doc.data().location,
        name: doc.data().name,
        tags: doc.data().tags
      })
    })
    return res.json(events);
  })
  .catch((err) => {
    console.log(err);
  })
}

exports.postEvent = (req, res) => {

  const newEvent = {
    name: req.body.name,
    description: req.body.description,
    createdAt: new Date().toISOString(),
    location: {
      geohash: geo.point(req.body.location.lat, req.body.location.lng).hash,
      geopoint: new admin.firestore.GeoPoint(req.body.location.lat, req.body.location.lng),
    },
    tags: req.body.tags
  };

  console.log(newEvent);

  db.collection('events').add(newEvent).then((doc) => {
    const resEvent = newEvent;
    resEvent.eventId = doc.id;
    return res.json({resEvent})
  })
  .catch((err) => {
    console.log(err);
    return res.status(500).json({error: 'something went wrong'})
  })
}
