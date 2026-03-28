import dotenv from 'dotenv';
dotenv.config();

export default {
  apiKey: process.env.API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  murfApiKey: process.env.MURF_API_KEY,
  murfRegion: process.env.MURF_REGION || 'in',
  // redisHost: process.env.REDIS_HOST || 'localhost',
  // redisPort: process.env.REDIS_PORT || 6379,
  port: process.env.PORT || 8000,
  guviCallbackUrl: 'https://hackathon.guvi.in/api/updateHoneyPotFinalResult'
};
