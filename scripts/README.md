# Database Management Scripts

This directory contains scripts to help manage your Firebase Firestore database.

## 🗑️ Clear Enquiries Scripts

### Method 1: Using Environment Variables (Recommended)

If you have your Firebase configuration set up in environment variables:

```bash
npm run clear-enquiries
```

This script reads your Firebase configuration from the same environment variables used by your Next.js app.

### Method 2: Direct Configuration

If you want to use a simpler approach or don't have environment variables set up:

1. Edit `scripts/clear-enquiries-simple.js`
2. Replace the placeholder values in the `firebaseConfig` object with your actual Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com", 
  projectId: "your-actual-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-actual-sender-id",
  appId: "your-actual-app-id"
};
```

3. Run the script:

```bash
node scripts/clear-enquiries-simple.js
```

## 🔧 Finding Your Firebase Configuration

You can find your Firebase configuration in:

1. **Firebase Console**: Go to Project Settings → General → Your apps → Web app → Config
2. **Your existing code**: Check `src/firebase/config.ts` or your environment variables

## ⚠️ Important Notes

- **This action cannot be undone!** All enquiry data will be permanently deleted.
- The script will ask for confirmation before proceeding.
- Make sure you have the necessary permissions to delete documents in your Firestore database.
- The script deletes documents in batches to avoid overwhelming the database.

## 🔒 Security

- Never commit your Firebase configuration to version control.
- Use environment variables for production applications.
- Ensure your Firestore security rules allow the deletion operation.

## 🐛 Troubleshooting

If you encounter permission errors:
1. Check your Firestore security rules
2. Ensure you're authenticated with the correct Firebase project
3. Verify your Firebase configuration is correct

If you encounter module errors:
1. Make sure you're in the correct directory (`hearing-hope-crm`)
2. Run `npm install` to ensure all dependencies are installed 