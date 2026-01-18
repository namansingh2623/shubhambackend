const express = require('express');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
// CORS configuration - Allow all origins for Docker deployment (nginx handles routing)
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
}));

// Handle preflight requests
app.options('*', (req, res) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

require('dotenv').config();

const albumsRouter = require('./routes/albums');
const usersRouter = require('./routes/users');
const photosRouter = require('./routes/photos');
const AnnouncementRouter = require('./routes/announcements');
const articlesRouter = require('./routes/articles');
const contactRouter = require('./routes/contact');
const AnnouncementFileRouter = require('./routes/announcementFiles')

const db = require('./config/database');
require('./models/index');
// Only sync in development - NEVER use force: true or alter: true in production!
// In production, use migrations instead of sync()
if (process.env.NODE_ENV !== 'production') {
    db.sync({ alter: false }).catch(err => {
        console.error('Database sync error:', err);
    });
} else {
    // In production, just authenticate - don't sync
    db.authenticate().catch(err => {
        console.error('Database connection error:', err);
    });
}
app.use(morgan('dev'));

// Raw body parser for articles endpoints (handles content-type issues)
app.use((req, res, next) => {
    if (req.method === 'POST' && (req.path === '/articles' || (req.path.startsWith('/articles/') && req.path.endsWith('/publish')))) {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            next();
        });
    } else if (req.method === 'PUT' && req.path.startsWith('/articles/') && req.path.endsWith('/sections')) {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            next();
        });
    } else if (req.method === 'POST' && req.path === '/albums/create') {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            next();
        });
    } else {
        next();
    }
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


//routes for localhost
app.use('/users', usersRouter);
app.use('/albums', albumsRouter);
app.use('/photos', photosRouter);
app.use('/Announcement', AnnouncementRouter);
app.use('/articles', articlesRouter);   // ← mount here
app.use('/contact', contactRouter); // Changed from /api/contact to match localhost pattern
// app.use('/AnnouncementFiles',AnnouncementFileRouter);
//routes for ec2 server

// app.use('/api/users', usersRouter);
// app.use('/api/albums', albumsRouter);
// app.use('/api/photos', photosRouter);
// app.use('/api/Announcement',AnnouncementRouter);


//error
app.use((req, res, next) => {
    let err = new Error('Not Found');
    err.status = 404;

    next(err);
});
app.use((error, req, res, next) => {
    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        const validationErrors = {};
        if (error.errors && Array.isArray(error.errors)) {
            error.errors.forEach((err) => {
                validationErrors[err.path] = err.message;
            });
        }
        return res.status(400).json({
            error: {
                message: error.message || 'Validation error',
                details: validationErrors
            }
        });
    }

    // Handle other Sequelize errors
    if (error.name && error.name.startsWith('Sequelize')) {
        return res.status(400).json({
            error: {
                message: error.message || 'Database error',
                type: error.name
            }
        });
    }

    // Handle other errors
    res.status(error.status || 500).json({
        error: {
            message: error.message || 'Internal server error'
        }
    });
});



module.exports = app;
