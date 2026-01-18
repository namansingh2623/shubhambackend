# Security Improvements Guide

## Critical Issues to Fix Immediately

### 1. Password Hashing (CRITICAL)

**Current Issue:** Passwords are stored in plain text in the database.

**Fix Steps:**

1. Install bcrypt:
```bash
npm install bcrypt
```

2. Update `models/User.js` to hash passwords:
```javascript
const bcrypt = require('bcrypt');

const User = db.define('user', {
    // ... existing fields ...
    password: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            min: 8,  // Increased minimum
            max: 100
        }
    },
}, {
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});
```

3. Update `routes/users.js` login to compare hashed passwords:
```javascript
const bcrypt = require('bcrypt');

router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;
    
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { name: user.firstName + ' ' + user.lastName, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '4h' }
        );
        res.json({ message: 'login successfully', token });
    } catch (err) {
        next(err);
    }
});
```

**Migration Note:** Existing users will need to reset their passwords after this change.

---

### 2. CORS Configuration (CRITICAL)

**Current Issue:** API allows requests from any origin.

**Fix Steps:**

Update `app.js`:
```javascript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : ['http://localhost:3000'], // Default to localhost for dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
}));
```

Update `.env`:
```env
ALLOWED_ORIGINS=https://radiologyillustration.com,https://www.radiologyillustration.com
```

---

## Important Improvements

### 3. Rate Limiting

Install express-rate-limit:
```bash
npm install express-rate-limit
```

Add to `app.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/users/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5 // 5 login attempts per 15 minutes
}));

app.use(limiter);
```

### 4. Input Sanitization

Install express-validator:
```bash
npm install express-validator
```

Use for all user inputs to prevent XSS and injection attacks.

### 5. File Upload Security

Add stricter validation in `routes/articles.js`:
```javascript
const upload = multer({ 
    storage, 
    limits: { fileSize: 2097152 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    }
});
```

### 6. Helmet.js for Security Headers

Install helmet:
```bash
npm install helmet
```

Add to `app.js`:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 7. Environment Variables Validation

Create a startup check to ensure all required env vars are set:
```javascript
const requiredEnvVars = [
    'JWT_SECRET',
    'MYSQL_DB_NAME',
    'MYSQL_USERNAME',
    'MYSQL_PASSWORD',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME'
];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});
```

---

## Security Checklist

- [ ] Implement password hashing with bcrypt
- [ ] Restrict CORS to specific origins
- [ ] Add rate limiting
- [ ] Implement input validation/sanitization
- [ ] Add file upload type validation
- [ ] Install and configure Helmet.js
- [ ] Add environment variable validation
- [ ] Ensure HTTPS/SSL is enabled in production
- [ ] Regular security audits of dependencies (`npm audit`)
- [ ] Set up proper logging and monitoring
- [ ] Implement proper error handling (don't expose stack traces in production)

---

## Additional Recommendations

1. **Regular Updates:** Keep all dependencies updated (`npm audit fix`)
2. **Database Backups:** Ensure regular automated backups
3. **Monitoring:** Set up error tracking (e.g., Sentry)
4. **SSL Certificate:** Ensure valid SSL certificate for HTTPS
5. **Security Headers:** Use Helmet.js to set security headers
6. **Session Management:** Consider shorter JWT expiration times for sensitive operations

