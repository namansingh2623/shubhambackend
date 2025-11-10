const express = require('express');
const router = express.Router();
const validate = require("validate.js");
const jwt = require("jsonwebtoken");


const User = require('../models/User');

router.post('/signup', (req, res, next) => {
  // Basic validation before attempting to save
  const { email, firstName, lastName, password } = req.body;
  
  if (!email || !firstName || !lastName || !password) {
    const details = {};
    if (!email) details.email = 'Email is required';
    if (!firstName) details.firstName = 'First name is required';
    if (!lastName) details.lastName = 'Last name is required';
    if (!password) details.password = 'Password is required';
    
    return res.status(400).json({
      error: {
        message: 'Missing required fields',
        details: details
      }
    });
  }
  
  new User({
    email: email.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    password: password
  })
      .save()
      .then((user)=>res.json({message:'User Created Successfully!'}))
      .catch(err=>next(err))

});

router.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});


router.post('/login', (req, res, next) => {
  const login = {email: req.body.email, password: req.body.password};
  User
      .findOne({where:login})
      .then((user)=>{
        if(user){
          const token = jwt.sign({name:user.firstName+' '+user.lastName, email: user.email}, process.env.JWT_SECRET, { expiresIn: '4h' });
          res.json({message:'login successfully',token})
        } else unAuthorized();
      }).catch(err=>next(err))


  const unAuthorized =  ()=> {
    const error = new Error();
    error.message = 'UnAuthorized!';
    error.status = 401 || status;
    next(error);
  };

});

module.exports = router;
