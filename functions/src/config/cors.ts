import * as cors from 'cors';

// CORS configuration with allowed origins
export const corsConfig = cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:5003',
    'https://okdates.web.app',
    'https://okdates.firebaseapp.com',
    'https://okdates.tribecans.com',
    'https://okdates.vanguardsignals.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
});