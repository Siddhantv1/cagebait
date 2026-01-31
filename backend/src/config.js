import dotenv from 'dotenv';
dotenv.config();

export default {
  apiKey: process.env.API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || 6379,
  port: process.env.PORT || 8000,
  guviCallbackUrl: 'https://hackathon.guvi.in/api/updateHoneyPotFinalResult'
};
