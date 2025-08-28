# Firebase Setup for Hearing Hope CRM

This document provides instructions for setting up the Firebase backend for the Hearing Hope CRM & Inventory Management System. The application uses Firebase for authentication, data storage, and hosting.

## Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)
- A Firebase account (free tier is sufficient to start)

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter "Hearing Hope CRM" as the project name
4. Enable Google Analytics if desired
5. Click "Create project"

## Step 2: Register your Web App

1. From the Firebase project dashboard, click the web icon (</>) to add a web app
2. Register the app with the name "Hearing Hope CRM Web"
3. Check the option for "Also set up Firebase Hosting"
4. Click "Register app"
5. Firebase will provide you with configuration values that you'll need for the next step

## Step 3: Set Up Environment Variables

Create a `.env.local` file in the root directory of your project with the following variables:

```
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Replace each placeholder with the values from your Firebase configuration.

## Step 4: Set Up Firebase Services

### Authentication

1. In Firebase Console, go to "Authentication" and click "Get started"
2. Enable Email/Password authentication method
3. Optionally enable Google authentication method
4. Add your first admin user manually by clicking "Add user" and entering email and password

### Firestore Database

1. Go to "Firestore Database" and click "Create database"
2. Start in production mode
3. Choose a location closest to your users (e.g., asia-south1 for India)
4. Create the database

### Storage

1. Go to "Storage" and click "Get started"
2. Choose the same location as your Firestore database
3. Set up storage rules

## Step 5: Set Up Firebase Rules

### Firestore Rules

1. Rename `firestore.rules.sample` to `firestore.rules`
2. Adjust the rules as needed for your production environment
3. Deploy the rules using the Firebase CLI

### Storage Rules

1. Rename `storage.rules.sample` to `storage.rules`
2. Adjust the rules as needed for your production environment
3. Deploy the rules using the Firebase CLI

## Step 6: Firebase Configuration Files

1. Rename `firebase.json.sample` to `firebase.json`
2. Rename `firestore.indexes.json.sample` to `firestore.indexes.json`
3. Update these files as needed for your specific project

## Step 7: Install Firebase CLI Tools

1. Install the Firebase CLI globally:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

3. Initialize Firebase in your project (this will create needed config files):
   ```
   firebase init
   ```
   
   Select the following features:
   - Firestore
   - Storage
   - Hosting
   - Emulators

## Step 8: Seed the Database with Initial Data

We've provided a script to populate your Firestore database with initial sample data.

1. Make sure your environment variables are set up correctly
2. Run the seed script:
   ```
   npm run seed
   ```

This will add sample products, customers, vendors, and other necessary data to get started.

## Step 9: Local Development with Firebase Emulators

1. Start the Firebase emulators:
   ```
   npm run firebase:emulators
   ```

2. Start your Next.js development server:
   ```
   npm run dev
   ```

3. Access your application at http://localhost:3000

## Step 10: Deployment to Firebase Hosting

1. Build your Next.js application for production:
   ```
   npm run build
   ```

2. Deploy to Firebase Hosting:
   ```
   npm run firebase:deploy
   ```

3. Your application will be available at the URL shown in the terminal after deployment.

## Database Schema

The database schema is documented in `src/firebase/schema.ts`. This file provides details about all collections and their fields.

## Available NPM Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the production application
- `npm run start` - Start the production server
- `npm run seed` - Populate Firestore with sample data
- `npm run firebase:emulators` - Start Firebase emulators for local development
- `npm run firebase:deploy` - Deploy application to Firebase Hosting

## Troubleshooting

### Common Issues

1. **Authentication Issues**: Make sure your Firebase Authentication settings match your application needs.

2. **Database Permissions**: If you're having issues with reads or writes, check your Firestore rules.

3. **Environment Variables**: Ensure your `.env.local` file contains all the required Firebase configuration values.

4. **Deployment Errors**: Check that your `firebase.json` is correctly set up for your project structure.

### Getting Help

- Check the [Firebase Documentation](https://firebase.google.com/docs) for detailed information
- Visit the [Firebase Support](https://firebase.google.com/support) page for additional help 