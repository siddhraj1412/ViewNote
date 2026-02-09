# ViewNote - Complete Setup Guide

## Prerequisites
- Node.js 18+ installed
- Firebase account
- TMDB API account

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# TMDB API
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Google Analytics (optional)

### 2. Enable Authentication
1. Go to Authentication → Sign-in method
2. Enable Email/Password
3. Enable Google Sign-in
4. Add authorized domain for production

### 3. Create Firestore Database
1. Go to Firestore Database
2. Create database in production mode
3. Update security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Watchlist rules
    match /watchlist/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Ratings rules
    match /ratings/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### 4. Enable Firebase Storage
1. Go to Storage
2. Get Started
3. Update security rules with content from `storage.rules` file

## TMDB API Setup

1. Go to [TMDB](https://www.themoviedb.org/)
2. Create an account
3. Go to Settings → API
4. Request an API key
5. Copy the API key to `.env.local`

## Features

- ✅ User authentication (Email/Password, Google)
- ✅ Movie and TV show search
- ✅ Personal watchlist
- ✅ Rating system (1-5 stars)
- ✅ Trending content
- ✅ Person/cast details
- ✅ Custom image uploads (Firebase Storage)
- ✅ Responsive design
- ✅ Error handling
- ✅ Performance optimization (caching)

## Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms
- Ensure Node.js 18+ is supported
- Set environment variables
- Run `npm run build` and `npm start`

## Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Check Node.js version (18+)
- Clear `.next` folder and rebuild

### Firebase Errors
- Verify Firebase configuration
- Check security rules
- Ensure authentication methods are enabled

### TMDB Errors
- Verify API key is valid
- Check API rate limits
- Ensure network connectivity

## Support

For issues or questions, check:
- Firebase documentation
- Next.js documentation
- TMDB API documentation
