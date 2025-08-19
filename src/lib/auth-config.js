import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
// import { MongoDBAdapter } from '@auth/mongodb-adapter';
// import clientPromise from './mongodb-adapter';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  // adapter: MongoDBAdapter(clientPromise), // Temporarily disabled
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          email: user.email, // Ensure email is preserved
          name: user.name,   // Ensure name is preserved
          accessToken: account.access_token,
          userId: user.id,
          role: user.role || 'user',
          subscriptionPlan: user.subscriptionPlan || 'free',
        };
      }
      return token;
    },
    async session({ session, token }) {
      // Ensure user email is preserved from token
      if (token.email) {
        session.user.email = token.email;
      }
      
      // Send properties to the client
      session.accessToken = token.accessToken;
      session.userId = token.userId;
      session.user.role = token.role;
      session.user.subscriptionPlan = token.subscriptionPlan;
      
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists in our custom User collection
          const { default: connectDB } = await import('./mongodb');
          await connectDB();
          
          const { default: User } = await import('@/models/User');
          const existingUser = await User.findOne({ email: user.email });
          
          if (existingUser) {
            // Update existing user's Google info
            await User.updateOne(
              { _id: existingUser._id },
              { 
                $set: { 
                  googleId: profile.sub,
                  lastLogin: new Date()
                }
              }
            );
            // Use existing user's role and subscription
            user.role = existingUser.role;
            user.subscriptionPlan = existingUser.subscriptionPlan;
            user.id = existingUser._id.toString(); // Set the MongoDB ID
          } else {
            // Create new user with Google info
            const newUser = new User({
              email: user.email,
              firstName: profile.given_name || user.name?.split(' ')[0] || '',
              lastName: profile.family_name || user.name?.split(' ').slice(1).join(' ') || '',
              username: user.email.split('@')[0], // Use email prefix as username
              googleId: profile.sub,
              role: 'user', // Default role
              subscriptionPlan: 'free', // Default plan
              subscriptionStatus: 'active',
              isVerified: true, // Google accounts are verified
              isActive: true,
              // Set a dummy password for Google users (won't be used)
              password: 'google_oauth_user_' + Date.now(),
            });
            
            const savedUser = await newUser.save();
            
            user.role = 'user';
            user.subscriptionPlan = 'free';
            user.id = savedUser._id.toString(); // Set the MongoDB ID
          }
          
          return true;
        } catch (error) {
          console.error('Error in Google OAuth sign in:', error);
          return false; // Prevent sign in if there's an error
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Comprehensive safety checks for static generation
      if (!url || typeof url !== 'string' || url.trim() === '') {
        return baseUrl;
      }
      
      if (!baseUrl || typeof baseUrl !== 'string') {
        return '/';
      }
      
      // Allows relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Allows callback URLs on the same origin (only check if it's a full URL)
      else if (url.startsWith('http')) {
        try {
          const urlOrigin = new URL(url).origin;
          if (urlOrigin === baseUrl) {
            return url;
          }
        } catch (urlError) {
          // URL parsing error, fall through to default
        }
      }
      
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions; 