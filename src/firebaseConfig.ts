// Paste your Firebase web-app config here (Project settings → General → Your apps → Web).
// These values are public by design (safe to ship in the frontend); Firestore is
// protected by the security rules in firestore.rules, not by hiding this config.
export const firebaseConfig = {
  apiKey: 'AIzaSyCUVt0iC7XJ2gEKi78utz4872CUMk4NGxw',
  // Matches the Hosting domain (not the default *.firebaseapp.com) so the auth
  // handler is same-site with the app — Safari/iOS ITP partitions storage across
  // sites, which breaks both popup and redirect sign-in when they don't match.
  authDomain: 'canopy-b9c49.web.app',
  projectId: 'canopy-b9c49',
  storageBucket: 'canopy-b9c49.firebasestorage.app',
  messagingSenderId: '216996098213',
  appId: '1:216996098213:web:afc354694e44b561009d4c',
}

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE')
