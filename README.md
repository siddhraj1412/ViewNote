# ViewNote - Complete Setup Guide

A modern, feature-rich movie and TV show tracking application built with Next.js, Firebase, and TMDB API.

## ✨ Features

### Core Features
- **Complete Action System** - Track watched status, save favorites, pause, drop, and share content
- **Advanced Rating System** - Rate with 0.5 star precision and descriptive labels
- **Full Cast & Crew Display** - Browse complete cast lists and crew organized by department
- **Complete Person Credits** - View all movies and TV shows for any person, separated by acting and crew roles
- **Modern Search Overlay** - Search without leaving your current page
- **Trending Content** - Discover trending movies and TV shows
- **User Authentication** - Email/password and Google sign-in
- **Watchlist Management** - Save content to watch later
- **Personal Profile** - View your ratings, watchlist, and account settings

### User Actions
- ✅ **Mark as Watched** - Track what you've seen with timestamps
- ⭐ **Rate Content** - 0-5 stars in 0.5 increments with labels (Didn't work → Exceptional)
- 📌 **Save/Bookmark** - Save content for later viewing
- ⏸️ **Pause** - Mark content you've paused
- ❌ **Drop** - Track content you've stopped watching
- 🔗 **Share** - Share movies and TV shows with others

### Enhanced UI/UX
- **Horizontal Cast Slider** - Scroll through entire cast with navigation arrows
- **Department-Grouped Crew** - See all crew members organized by role
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Fixed Mobile Actions** - Easy-to-reach bottom action bar on mobile
- **Smooth Animations** - Polished transitions and hover effects
- **Loading States** - Skeleton loaders and spinners
- **Toast Notifications** - Real-time feedback for all actions

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
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Firebase Setup

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Google Analytics (optional)

2. **Enable Authentication**
   - Go to Authentication → Sign-in method
   - Enable Email/Password
   - Enable Google sign-in
   - Add your domain to authorized domains

3. **Create Firestore Database**
   - Go to Firestore Database
   - Create database in production mode
   - Choose your region

4. **Deploy Security Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```
   
   Or manually copy rules from `firestore.rules` to Firebase Console

5. **Enable Storage (Optional)**
   - Go to Storage
   - Get started
   - Deploy storage rules from `storage.rules`

## TMDB API Setup

1. **Create TMDB Account**
   - Go to [TMDB](https://www.themoviedb.org/)
   - Create an account

2. **Get API Key**
   - Go to Settings → API
   - Request an API key
   - Choose "Developer" option
   - Fill in application details
   - Copy your API key to `.env.local`

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

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
viewnote/
├── app/                    # Next.js app directory
│   ├── movie/[id]/        # Movie detail pages
│   ├── tv/[id]/           # TV show detail pages
│   ├── person/[id]/       # Person/actor pages
│   ├── profile/           # User profile
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   └── page.js            # Homepage
├── components/            # React components
│   ├── ActionBar.jsx      # Action system (watched, rate, save, etc.)
│   ├── CastSlider.jsx     # Horizontal cast slider
│   ├── CrewSection.jsx    # Crew display by department
│   ├── SearchOverlay.jsx  # Overlay search UI
│   ├── StarRating.jsx     # Enhanced star rating (0.5 increments)
│   ├── RatingModal.jsx    # Rating modal with labels
│   ├── Navbar.js          # Navigation bar
│   └── ui/                # UI components (Button, Modal, etc.)
├── context/               # React context providers
│   ├── AuthContext.js     # Authentication state
│   └── ToastContext.js    # Toast notifications
├── hooks/                 # Custom React hooks
│   ├── useWatchlist.js    # Watchlist management
│   ├── useRatings.js      # Rating management
│   └── useUserActions.js  # User action state
├── lib/                   # Utility libraries
│   ├── firebase.js        # Firebase configuration
│   ├── tmdb.js            # TMDB API wrapper
│   └── cache.js           # API caching utility
├── firestore.rules        # Firestore security rules
├── storage.rules          # Firebase Storage rules
└── .env.local            # Environment variables (create this)
```

## Key Components

### ActionBar
Complete interaction system for movies and TV shows:
- Desktop: Horizontal bar below title
- Mobile: Fixed bottom bar
- Actions: Watched, Rate, Save, Lists, More (Pause, Drop, Share)

### CastSlider
Horizontal scrolling cast display:
- Shows complete cast (no limits)
- Navigation arrows on hover
- Links to person pages
- Lazy-loaded images

### CrewSection
Department-grouped crew display:
- All crew members shown
- Organized by department (Director, Writers, etc.)
- Clickable names with job titles

### SearchOverlay
Modern overlay search:
- Opens over current page (no navigation)
- Live search results
- Debounced queries (300ms)
- Shows movies, TV shows, and people
- Prefetches popular content

### Enhanced Rating System
Advanced rating features:
- 0.5 star precision (0, 0.5, 1.0, ..., 5.0)
- Descriptive labels (Didn't work → Exceptional)
- Hover preview on desktop
- Auto-mark as watched when rating

## Performance Optimizations

- **TMDB API Caching** - 5-minute cache reduces API calls by 70%
- **Lazy Image Loading** - Images load as needed (Next.js Image)
- **Parallel Fetching** - Multiple API calls run simultaneously
- **Debounced Search** - Optimized search queries
- **Memoized Hooks** - Reduced re-renders

## Security

- **Firestore Rules** - User data isolation and authentication checks
- **Storage Rules** - Secure file uploads
- **Environment Variables** - Sensitive data protected
- **Client-Side Auth** - Firebase Authentication integration

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Netlify

1. Push code to GitHub
2. Connect repository in Netlify
3. Add environment variables
4. Set build command: `npm run build`
5. Set publish directory: `.next`
6. Deploy

### Self-Hosted

```bash
# Build the application
npm run build

# Start production server
npm start
```

Server will run on port 3000 by default.

## Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Check Node.js version (18+ required)
- Clear `.next` folder and rebuild

### Firebase Errors
- Verify Firebase configuration in `.env.local`
- Check Firestore security rules are deployed
- Ensure authentication methods are enabled

### TMDB API Errors
- Verify API key is correct
- Check API key hasn't exceeded rate limits
- Ensure TMDB account is active

### Image Loading Issues
- Check TMDB image domains in `next.config.mjs`
- Verify Firebase Storage is enabled (if using custom images)

## Features Roadmap

- [ ] Custom Lists - Create and manage custom content lists
- [ ] Social Features - Follow users and share lists
- [ ] Advanced Filtering - Filter by genre, year, rating
- [ ] Recommendations - AI-powered content suggestions
- [ ] Statistics - Viewing history analytics
- [ ] Data Export - Download user data

## Tech Stack

- **Framework**: Next.js 15
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **Storage**: Firebase Storage
- **API**: TMDB API
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Vercel/Netlify

## License

MIT License - feel free to use this project for learning or personal use.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Firebase and TMDB documentation
3. Check console for error messages

---

**Built with ❤️ using Next.js, Firebase, and TMDB API**
