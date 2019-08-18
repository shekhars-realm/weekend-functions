const moment = require('moment');

const isEmpty = (string) => {
  if(string.trim() === '') return true
  else return false
}

const isEmail = (email) => {
  const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if(email.match(emailRegEx)) return true
  else return false
}

exports.validateSignUpData = (data) => {
  let errors = {};

  if(isEmpty(data.email)) {
    errors.email = 'Email must not be empty'
  } else if(!isEmail(data.email)) {
    errors.email = 'Must be a valid email address'
  }

  if(isEmpty(data.password)) errors.password = 'Must not be empty'
  if(data.password !== data.confirmPassword) errors.confirmPassword = 'Passowrds must be the same'
  if(isEmpty(data.handle)) errors.handle = 'Must not be empty'

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  }
}

exports.validateLogInData = (data) => {
  let errors = {}

  if(isEmpty(data.email)) errors.email = 'Must not be empty';
  if(isEmpty(data.password)) errors.password = 'Must not be empty';
  if(!isEmail(data.email)) errors.email = 'Must be a valid email address';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  }
}

exports.reduceUserDetails = (data) => {
  let userDetails = {};
  console.log('data from req: ',data);
  if(!isEmpty(data.bio)) userDetails.bio = data.bio;
  if(!isEmpty(data.location)) userDetails.location = data.location;
  if(!isEmpty(data.website)) {
    if(data.website.trim().substring(0,4) !== 'http') {
      userDetails.website = `http://${data.website.trim()}`;
    } else userDetails.website = data.website;
    return userDetails
  }
}

exports.validateNewEvent = (req) => {
  console.log('new event: ', req.body);
  let errors = {}
  req.user.schedule.map(event => {
    if(
      moment(req.body.startTime).isBetween(moment(event.startTime), moment(event.endTime))
      ||
      moment(req.body.endTime).isBetween(moment(event.startTime), moment(event.endTime))
      ||
      moment(event.startTime).isBetween(moment(req.body.startTime), moment(req.body.endTime))
    ) {
      errors.overlapped = 'Clear your schedule for this time!'
      return errors
    }
  })
  if(isEmpty(req.body.name)) {
    errors.name = 'Event name cannot be empty!'
  }
  if(new Date(req.body.startTime).getTime() < new Date().getTime() + (3600000*2) ) {
    errors.startTime = 'Event needs to start atleast 2 hours from now!'
  }
  if((new Date(req.body.endTime).getTime() - new Date(req.body.startTime).getTime()) < 1800000) {
    errors.endTime = 'Event should last atleast 30 minutes!'
  }
  if(Object.keys(req.body.location).length === 0) {
    errors.location = 'Please add a meet uo point!'
  }
  if(req.body.tags.length === 0) {
    errors.tags = 'Cannot leave empty. Add tags to make your event easy to find!'
  }
  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  }
}

validateFilters = (req) => {
  let filter = {}
  if(Object.keys(req.body.location).length !== 0) {
    filter.location = req.body.location;
  }
  if(!isEmpty(req.body.searchText)) {
    filter.searchText = req.body.searchText;
  }
  filter.radius = req.body.radius;
  filter.startTime = req.body.startTime;

  return filter;
}

exports.validateJoinEvent = (req, timeObj) => {
  let errors = {}
  req.user.schedule.map(event => {
    if(
      moment(timeObj.startTime).isBetween(moment(event.startTime), moment(event.endTime))
      ||
      moment(timeObj.endTime).isBetween(moment(event.startTime), moment(event.endTime))
      ||
      moment(event.startTime).isBetween(moment(timeObj.startTime), moment(timeObj.endTime))
    ) {
      errors.overlapped = 'Clear your schedule for this time!'
    }
  })
  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  }
}

exports.validateRating = (req) => {
  let rating = {}
  if(req.body.fun) rating.fun = req.body.fun;
  if(req.body.interaction) rating.interaction = req.body.interaction;
  if(req.body.wellPlanned) rating.wellPlanned = req.body.wellPlanned;
  if(req.body.suggestion) rating.suggestion = req.body.suggestion;
  rating.createdAt = new Date().toISOString();
  rating.user = req.user.handle;
  return rating
}
