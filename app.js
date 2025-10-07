const express = require('express');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
app.use(cors());

require('dotenv').config();

const albumsRouter = require('./routes/albums');
const usersRouter = require('./routes/users');
const photosRouter = require('./routes/photos');
const AnnouncementRouter=require('./routes/announcements');

// const AnnouncementFileRouter=require('./routes/announcementFiles')

const db = require('./config/database');
require('./models/index');
db.sync();
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


//routes for localhost
app.use('/users', usersRouter);
app.use('/albums', albumsRouter);
app.use('/photos', photosRouter);
app.use('/Announcement',AnnouncementRouter);

// app.use('/AnnouncementFiles',AnnouncementFileRouter);
//routes for ec2 server

// app.use('/api/users', usersRouter);
// app.use('/api/albums', albumsRouter);
// app.use('/api/photos', photosRouter);
// app.use('/api/Announcement',AnnouncementRouter);


//error
app.use((req,res,next)=>{
    let err = new Error('Not Found');
    err.status = 404;

    next(err);
});
app.use((error, req, res,next) => {
    res.status(error.status || 500).json({error: {message:error.message} || ''})
});



module.exports = app;
