export function emojiToSVG(content: string): string {
  const safeContent = content.substring(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" fill="black" rx="50" ry="50" />
    <text x="50%" y="50%" font-family="sans-serif" font-size="40" fill="white" text-anchor="middle" dominant-baseline="central">
      ${safeContent}
    </text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function generateLinkUpplyId(name: string): string {
  const shortName = name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `${shortName}-${randomDigits}`;
}

export function getFirebaseErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address. Please check and try again.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/email-already-in-use':
      return 'This email is already in use. Please login instead.';
    case 'auth/operation-not-allowed':
      return 'This login method is not allowed.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/popup-closed-by-user':
      return 'Login window was closed. Please try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. Please add your App URL (and capacitor://localhost for mobile) to Firebase Console -> Authentication -> Settings -> Authorized domains.';
    case 'auth/internal-error':
      return 'Internal server error. Please try again later.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}
