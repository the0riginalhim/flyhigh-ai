require('dotenv').config();
const connectDB = require('./config/db');
connectDB();
const express = require('express');
const cors = require('cors');

const bookRoutes = require('./routes/book');
const chatbotRoutes = require('./routes/chatbot.js');
const userRoutes = require('./routes/user.js'); 

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
const corsOptions = {
  origin: 'https://fly-high-ai.netlify.app'
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/chat', chatbotRoutes);
app.use('/api/book', bookRoutes);
app.use('/api/users', userRoutes); 

// Root Route
app.get('/', (req, res) => {
  res.send('Flight Bot API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

