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

// --- 1. SÉCURITÉ DE BASE ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Permet d'afficher les images/uploads sur d'autres domaines
}));

// --- 2. CONFIGURATION CORS CORRIGÉE ---
// On autorise tout en développement et spécifiquement ton Vercel en production
const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://frontend-weld-rho-90.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        // Autorise les requêtes sans origine (comme Postman ou mobiles) ou les origines dans la liste
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Gère spécifiquement les requêtes OPTIONS (Preflight)
app.options('*', cors());

// --- 3. MIDDLEWARES DE PARSING ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 4. LIMITATION DE DÉBIT (RATE LIMITING) ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: { error: "Trop de requêtes, réessayez plus tard." }
});
// Appliquer seulement aux routes API
app.use('/api/', limiter);

// --- 5. FICHIERS STATIQUES ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 6. ROUTES ---
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);

// --- 7. ROUTE DE SANTÉ (HEALTH CHECK) ---
// Très important pour Render pour vérifier si le serveur est "Live"
app.get('/', (req, res) => {
    res.send('Backend is running!');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// --- 8. GESTION DES ERREURS ---
app.use(errorHandler);

// --- 9. LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 10000; // Render utilise souvent le port 10000 par défaut
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is live on port ${PORT}`);
});

module.exports = app;