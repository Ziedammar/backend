require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const supportRoutes = require('./src/controllers/supportController');
const adminRoutes = require('./src/controllers/adminController');
const ticketRoutes = require('./src/controllers/ticketController');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());

// --- MODIFICATION CORS ICI ---
app.use(cors({
    origin: [
        'http://localhost:3001', 
        'http://localhost:5500', 
        'https://frontend-weld-rho-90.vercel.app' // Ton site en ligne
    ],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100 
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// Routes
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;