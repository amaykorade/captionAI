import jwt from 'jsonwebtoken';
import User from '@/models/User';
import connectDB from '@/lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function getTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const idx = c.indexOf('=');
    const name = c.slice(0, idx).trim();
    const value = c.slice(idx + 1).trim();
    return [name, value];
  }));
  return cookies['auth_token'] || null;
}

// Verify JWT token and return user data
export async function verifyToken(token) {
  try {
    if (!token) {
      return { isValid: false, error: 'No token provided' };
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '');
    
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    
    // Connect to database and get user
    await connectDB();
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return { isValid: false, error: 'User not found' };
    }
    
    if (!user.isActive) {
      return { isValid: false, error: 'User account is deactivated' };
    }
    
    return { 
      isValid: true, 
      user: user,
      userId: user._id 
    };
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return { isValid: false, error: 'Invalid token' };
    }
    if (error.name === 'TokenExpiredError') {
      return { isValid: false, error: 'Token expired' };
    }
    return { isValid: false, error: 'Token verification failed' };
  }
}

// Middleware function to protect API routes
export async function authenticateUser(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = null;
    if (authHeader) {
      token = authHeader;
    } else {
      const cookieHeader = request.headers.get('cookie');
      const cookieToken = getTokenFromCookies(cookieHeader);
      if (cookieToken) token = cookieToken;
    }
    
    if (!token) {
      return { isAuthenticated: false, error: 'Authorization missing' };
    }
    
    const authResult = await verifyToken(token);
    
    if (!authResult.isValid) {
      return { 
        isAuthenticated: false, 
        error: authResult.error 
      };
    }
    
    return { 
      isAuthenticated: true, 
      user: authResult.user,
      userId: authResult.userId 
    };
    
  } catch (error) {
    return { 
      isAuthenticated: false, 
      error: 'Authentication failed' 
    };
  }
}

// Generate JWT token for user
export function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
} 