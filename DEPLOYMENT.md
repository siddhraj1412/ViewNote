# ViewNote - Deployment & Testing Guide

## 🚀 DEPLOYMENT CHECKLIST

### 1. Firebase Setup & Security Rules

#### Deploy Firestore Security Rules
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done)
firebase init firestore

# Deploy security rules
firebase deploy --only firestore:rules
```

#### Verify Security Rules
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database → Rules
4. Verify rules match `firestore.rules` file
5. Test rules with Firebase Emulator (optional)

#### Enable Required Firebase Services
- ✅ Authentication (Email/Password, Google)
- ✅ Firestore Database
- ✅ Firebase Storage (optional, for custom images)

---

### 2. Environment Variables

Ensure `.env.local` is configured:

```env
# TMDB API
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

### 3. Build & Deploy

#### Local Testing
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test at http://localhost:3000
```

#### Production Build
```bash
# Build for production
npm run build

# Test production build locally
npm start
```

#### Deploy to Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or use Vercel Dashboard:
# 1. Push to GitHub
# 2. Import project in Vercel
# 3. Add environment variables
# 4. Deploy
```

---

## ✅ COMPREHENSIVE TESTING GUIDE

### Homepage Testing
- [ ] Page loads without errors
- [ ] Trending movies display correctly
- [ ] Trending TV shows display correctly
- [ ] All images load with fallbacks
- [ ] Search icon opens SearchOverlay
- [ ] Navigation works
- [ ] Mobile responsive layout

### Movie Page Testing
- [ ] Movie details load correctly
- [ ] Banner/backdrop displays
- [ ] Poster displays with fallback
- [ ] ActionBar visible (desktop horizontal)
- [ ] ActionBar visible (mobile bottom fixed)
- [ ] Watched toggle works
- [ ] Rate button opens modal
- [ ] Save/Bookmark toggle works
- [ ] More menu opens (Pause, Drop, Share)
- [ ] CastSlider displays all cast
- [ ] Cast slider arrows work
- [ ] Cast slider scrolls on mobile
- [ ] CrewSection displays all crew
- [ ] Crew grouped by department
- [ ] Similar movies display
- [ ] All links work

### TV Show Page Testing
- [ ] TV show details load correctly
- [ ] Banner/backdrop displays
- [ ] Poster displays with fallback
- [ ] ActionBar visible (desktop horizontal)
- [ ] ActionBar visible (mobile bottom fixed)
- [ ] Watched toggle works
- [ ] Rate button opens modal
- [ ] Save/Bookmark toggle works
- [ ] More menu opens (Pause, Drop, Share)
- [ ] CastSlider displays all cast
- [ ] Cast slider arrows work
- [ ] Cast slider scrolls on mobile
- [ ] CrewSection displays all crew
- [ ] Crew grouped by department
- [ ] Similar shows display
- [ ] Seasons count displays
- [ ] All links work

### Person Page Testing
- [ ] Person details load correctly
- [ ] Profile image displays with fallback
- [ ] Biography displays
- [ ] Birthday displays (if available)
- [ ] Place of birth displays (if available)
- [ ] Known for department displays
- [ ] Movies (Acting) section displays ALL credits
- [ ] Movies (Crew) section displays ALL credits
- [ ] TV Shows (Acting) section displays ALL credits
- [ ] TV Shows (Crew) section displays ALL credits
- [ ] Credits sorted by year (descending)
- [ ] Grid layout responsive (5 per row → mobile)
- [ ] All credit links work
- [ ] No missing entries

### Rating System Testing
- [ ] Rating modal opens from ActionBar
- [ ] Can select 0.5 increments (0, 0.5, 1.0, ..., 5.0)
- [ ] Hover preview works on desktop
- [ ] Rating labels display correctly
- [ ] Can save rating
- [ ] Can edit existing rating
- [ ] Auto-marks as watched when rating
- [ ] Rating persists to Firestore
- [ ] Rating displays on page reload

### Search Overlay Testing
- [ ] Opens from navbar search icon
- [ ] Displays popular content when empty
- [ ] Live search works (debounced)
- [ ] Results display for movies
- [ ] Results display for TV shows
- [ ] Results display for people
- [ ] Can click results to navigate
- [ ] ESC key closes overlay
- [ ] Click outside closes overlay
- [ ] No page navigation occurs
- [ ] Mobile responsive

### Action Persistence Testing
- [ ] Watched status persists to Firestore
- [ ] Watched status loads on page reload
- [ ] Save status persists to Firestore
- [ ] Save status loads on page reload
- [ ] Pause status persists to Firestore
- [ ] Drop status persists to Firestore
- [ ] Ratings persist to Firestore
- [ ] All actions sync across sessions
- [ ] Actions only visible to logged-in users

### Authentication Testing
- [ ] Can sign up with email/password
- [ ] Can log in with email/password
- [ ] Can log in with Google
- [ ] Can log out
- [ ] Protected routes redirect to login
- [ ] User state persists on reload
- [ ] Profile page displays user info

### Mobile Responsiveness Testing
- [ ] Homepage responsive
- [ ] Movie page responsive
- [ ] TV page responsive
- [ ] Person page responsive
- [ ] ActionBar fixed at bottom on mobile
- [ ] Search overlay responsive
- [ ] Navigation menu works on mobile
- [ ] All touch interactions work
- [ ] Images scale properly
- [ ] Text readable on small screens

### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] Images lazy load
- [ ] API calls cached (check Network tab)
- [ ] No unnecessary re-renders
- [ ] Smooth scrolling
- [ ] No layout shifts
- [ ] Lighthouse score > 80

### Error Handling Testing
- [ ] Invalid movie ID shows error
- [ ] Invalid TV ID shows error
- [ ] Invalid person ID shows error
- [ ] Network errors show toast
- [ ] Missing images show fallbacks
- [ ] Empty states display correctly
- [ ] No console errors in production

---

## 🔍 BROWSER TESTING MATRIX

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile

### Screen Sizes
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile (414x896)

---

## 🐛 COMMON ISSUES & FIXES

### Build Errors
**Issue:** Build fails with environment variable errors
**Fix:** Ensure all `NEXT_PUBLIC_*` variables are set in `.env.local`

### Firebase Errors
**Issue:** "Permission denied" errors
**Fix:** Deploy Firestore security rules with `firebase deploy --only firestore:rules`

### Image Loading Issues
**Issue:** Images not loading
**Fix:** Check `next.config.mjs` has correct image domains

### API Rate Limits
**Issue:** TMDB API rate limit exceeded
**Fix:** Caching is implemented (5-minute TTL), wait or upgrade TMDB plan

### Action Persistence Issues
**Issue:** Actions not saving
**Fix:** Check user is logged in, verify Firestore rules, check console for errors

---

## 📊 PERFORMANCE BENCHMARKS

### Target Metrics
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1
- **Lighthouse Performance:** > 80
- **Lighthouse Accessibility:** > 90

### Optimization Features
- ✅ TMDB API caching (5-minute TTL)
- ✅ Next.js Image optimization
- ✅ Lazy loading
- ✅ Parallel API fetching
- ✅ Debounced search (300ms)
- ✅ Memoized components
- ✅ Code splitting

---

## 🔒 SECURITY CHECKLIST

- [ ] Firestore security rules deployed
- [ ] User data isolated by userId
- [ ] Authentication required for actions
- [ ] Environment variables not exposed
- [ ] No sensitive data in client code
- [ ] CORS configured correctly
- [ ] API keys restricted (if possible)

---

## 📝 PRE-DEPLOYMENT CHECKLIST

### Code Quality
- [ ] No console.log statements (console.error is OK)
- [ ] All imports optimized
- [ ] No unused variables
- [ ] No TypeScript errors (if using TS)
- [ ] Code formatted consistently

### Functionality
- [ ] All features working
- [ ] All pages accessible
- [ ] All links functional
- [ ] All images loading
- [ ] All actions persisting

### Performance
- [ ] Build completes successfully
- [ ] No build warnings
- [ ] Bundle size optimized
- [ ] Lighthouse score acceptable

### Documentation
- [ ] README updated
- [ ] Environment variables documented
- [ ] Deployment steps clear
- [ ] Known issues documented

---

## 🎉 POST-DEPLOYMENT VERIFICATION

After deploying to production:

1. **Smoke Test**
   - [ ] Homepage loads
   - [ ] Can search for content
   - [ ] Can view movie details
   - [ ] Can view TV details
   - [ ] Can view person details

2. **Authentication Test**
   - [ ] Can sign up
   - [ ] Can log in
   - [ ] Can log out

3. **Core Features Test**
   - [ ] Can mark as watched
   - [ ] Can rate content
   - [ ] Can save content
   - [ ] Actions persist

4. **Performance Test**
   - [ ] Page load times acceptable
   - [ ] Images load quickly
   - [ ] No errors in console

---

## 📞 SUPPORT & TROUBLESHOOTING

### Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TMDB API Documentation](https://developers.themoviedb.org/3)

### Debug Mode
Enable debug logging:
```javascript
// In lib/firebase.js
if (process.env.NODE_ENV === 'development') {
  console.log('Firebase initialized');
}
```

### Health Check Endpoints
Create a health check page at `/api/health`:
```javascript
export default function handler(req, res) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

---

**Testing Status:** Ready for comprehensive testing ✅  
**Deployment Status:** Ready for production deployment ✅  
**Documentation Status:** Complete ✅
