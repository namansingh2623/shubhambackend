const express = require('express');
const router = express.Router();
const validate = require("validate.js");
const jwt = require("jsonwebtoken");


const User = require('../models/User');

router.post('/signup', (req, res, next) => {
  new User({
    email:req.body.email,
    firstName:req.body.firstName,
    lastName:req.body.lastName,
    password:req.body.password
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
