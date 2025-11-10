# Troubleshooting S3 Image Deletion Issues

## Common Issues and Solutions

### 1. IAM Permissions Missing

**Symptom**: Images are not deleted, logs show `AccessDenied` or `403` errors.

**Solution**: Ensure your IAM user has `s3:DeleteObject` permission.

**Check IAM Policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:DeleteObject",  // ← This is required!
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::radiobucketnaman/Gallery/*",
                "arn:aws:s3:::radiobucketnaman/Articles/*"
            ]
        }
    ]
}
```

**Steps:**
1. Go to AWS Console → IAM → Users
2. Find your IAM user (the one with access keys in `.env`)
3. Check Permissions tab
4. Ensure `s3:DeleteObject` is included in the policy

### 2. Incorrect S3 Key Format

**Symptom**: Logs show "Could not extract S3 key from URL" warnings.

**Check:**
- The image URL format in your database
- The key extraction logic matches your S3 URL format

**Common S3 URL formats:**
- `https://bucket-name.s3.region.amazonaws.com/Articles/cover-xxx.jpg`
- `https://s3.region.amazonaws.com/bucket-name/Articles/cover-xxx.jpg`

**Debug:**
Check your backend logs when deleting. You should see:
```
✅ Successfully deleted cover image: Articles/cover-xxx.jpg
```

If you see warnings, the key extraction failed.

### 3. Bucket Name Mismatch

**Symptom**: Delete operations fail silently.

**Check:**
- Your `.env` file has correct `S3_BUCKET_NAME`
- The bucket name matches exactly (case-sensitive)

**Verify:**
```bash
# On EC2, check your .env
cat .env | grep S3_BUCKET_NAME
```

Should be: `S3_BUCKET_NAME=radiobucketnaman` (no spaces, exact match)

### 4. Images in Gallery vs Articles Folder

**For Albums:**
- Uses `photo.storageId` directly from database
- Should be in format: `Gallery/uuid.jpg` or just `uuid.jpg`

**For Articles:**
- Cover images: `Articles/cover-xxx.jpg`
- Figure images: `Articles/figure-xxx.jpg`

**Check storageId format:**
```sql
-- Check photo storage IDs
SELECT id, storageId FROM photos LIMIT 5;

-- Check article cover images
SELECT id, coverImage FROM articles WHERE coverImage IS NOT NULL LIMIT 5;
```

### 5. Check Backend Logs

**On EC2, check logs:**

```bash
# If using PM2
pm2 logs --lines 100 | grep -i "delete\|s3\|error"

# If using Docker
docker-compose logs | grep -i "delete\|s3\|error"

# If using systemd
sudo journalctl -u your-service -n 100 | grep -i "delete\|s3\|error"
```

**Look for:**
- ✅ `Successfully deleted` messages
- ❌ `Failed to delete` messages
- ⚠️ `AccessDenied` or `403` errors
- ⚠️ `Could not extract S3 key` warnings

### 6. Test Delete Manually

**Test with AWS CLI (if installed on EC2):**

```bash
# Test delete permission
aws s3 rm s3://radiobucketnaman/Articles/test-image.jpg

# If this fails with AccessDenied, your IAM user lacks permission
```

### 7. Verify IAM User is Active

**Check:**
1. AWS Console → IAM → Users
2. Find your user
3. Check Security credentials tab
4. Ensure access key is "Active" (not "Inactive")

### 8. Check S3 Bucket Policy

**Important**: The bucket policy should NOT include `s3:DeleteObject` for public access. Delete permissions should only be in IAM policy.

**Bucket Policy (Public Read Only):**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": ["s3:GetObject"],  // Only read, no delete
            "Resource": [
                "arn:aws:s3:::radiobucketnaman/Gallery/*",
                "arn:aws:s3:::radiobucketnaman/Articles/*"
            ]
        }
    ]
}
```

**IAM Policy (Backend Delete):**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:DeleteObject",  // Delete permission here
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::radiobucketnaman/Gallery/*",
                "arn:aws:s3:::radiobucketnaman/Articles/*"
            ]
        }
    ]
}
```

## Quick Diagnostic Checklist

- [ ] IAM user has `s3:DeleteObject` permission
- [ ] Access keys in `.env` are correct and active
- [ ] `S3_BUCKET_NAME` in `.env` matches actual bucket name
- [ ] Backend logs show delete attempts (check for errors)
- [ ] S3 key format matches what's stored in database
- [ ] Backend service restarted after updating `.env`

## Still Not Working?

1. **Check backend logs** for specific error messages
2. **Test IAM permissions** with AWS CLI
3. **Verify bucket name** matches exactly
4. **Check S3 key format** in database vs what code expects

