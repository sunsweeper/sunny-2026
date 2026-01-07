const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

const { sessionMiddleware } = require('./middleware/session');
const chatRoute = require('./routes/chat');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigin = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || '*';

const corsOptions = {
  origin: allowedOrigin === '*' ? true : allowedOrigin,
  credentials: allowedOrigin !== '*',
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/chat', chatRoute);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Sunny backend listening on port ${PORT}`);
});
