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
