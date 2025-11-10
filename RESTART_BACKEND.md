# How to Restart Backend After Updating .env

## Step 1: Update .env File on EC2

First, make sure you've updated your `.env` file on your EC2 instance with the new AWS credentials:

```bash
# SSH into your EC2 instance
ssh ec2-user@your-ec2-ip

# Navigate to your backend directory
cd /path/to/your/backend

# Edit .env file (use nano, vim, or your preferred editor)
nano .env
# or
vim .env

# Update these lines with your new credentials:
S3_ACCESS_ID=AKIA... (your new access key)
S3_API_KEY=... (your new secret key)
```

## Step 2: Restart Backend Service

Choose the method based on how your backend is running:

### Method 1: Using PM2 (Most Common on EC2)

```bash
# Check if PM2 is installed
pm2 --version

# List running processes
pm2 list

# Restart all processes
pm2 restart all

# Or restart a specific app
pm2 restart school-backend
# or
pm2 restart 0  # where 0 is the process ID

# Check logs to verify it started correctly
pm2 logs
```

### Method 2: Using Docker/Docker Compose

```bash
# If using docker-compose
docker-compose restart

# Or if using docker directly
docker ps  # Find your container name/ID
docker restart <container-name-or-id>

# Or rebuild and restart
docker-compose down
docker-compose up -d
```

### Method 3: Using systemd (Service)

```bash
# Check service name (usually something like node-app or backend)
sudo systemctl list-units | grep -E "node|backend|app"

# Restart the service
sudo systemctl restart your-service-name

# Check status
sudo systemctl status your-service-name

# View logs
sudo journalctl -u your-service-name -f
```

### Method 4: Manual Node Process

```bash
# Find the process
ps aux | grep node

# Kill the old process
kill <PID>

# Or kill all node processes (be careful!)
pkill node

# Start again
npm start
# or
node ./bin/www
# or
npm run dev  # if using nodemon
```

### Method 5: Using Forever (if installed)

```bash
# List processes
forever list

# Restart all
forever restartall

# Or restart specific
forever restart <script-name>
```

## Step 3: Verify It's Working

After restarting, verify the backend is working:

```bash
# Check if the process is running
ps aux | grep node

# Test the API endpoint
curl http://localhost:3307/api/articles
# or
curl http://your-domain.com/api/articles

# Check logs for any errors
# (use the appropriate log command for your setup)
```

## Quick Commands Reference

```bash
# PM2
pm2 restart all
pm2 logs

# Docker
docker-compose restart
docker-compose logs -f

# systemd
sudo systemctl restart backend
sudo systemctl status backend

# Manual
pkill node && npm start
```

## Troubleshooting

If the backend doesn't start:

1. **Check .env file syntax:**
   ```bash
   cat .env | grep S3
   ```

2. **Check for errors in logs:**
   ```bash
   # PM2
   pm2 logs --err
   
   # Docker
   docker-compose logs
   
   # systemd
   sudo journalctl -u your-service -n 50
   ```

3. **Verify environment variables are loaded:**
   ```bash
   # Add this temporarily to your app.js to debug
   console.log('S3_ACCESS_ID:', process.env.S3_ACCESS_ID ? 'Set' : 'Not set');
   ```

4. **Test S3 connection:**
   - Try uploading an image through your admin panel
   - Check backend logs for S3 errors

## Important Notes

- ✅ Make sure `.env` file is in the correct directory (same as `package.json`)
- ✅ No spaces around `=` in `.env` file (use `KEY=value` not `KEY = value`)
- ✅ Restart the service after updating `.env` (environment variables are loaded at startup)
- ✅ Check logs immediately after restart to catch any errors

## Using Deploy Script

If you have a `deploy.sh` script on EC2, simply run:

```bash
# SSH into EC2
ssh ec2-user@your-ec2-ip

# Navigate to your project directory
cd /path/to/your/project

# Run deploy script
./deploy.sh
# or
bash deploy.sh
```

The deploy script should handle:
- Pulling latest code
- Installing dependencies
- Restarting the service
- Any other deployment steps
