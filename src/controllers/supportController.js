const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chatbotService = require('../services/chatbotService');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'));
        }
    }
});

// GET /api/support/history/:sessionId - Récupérer l'historique d'une session
router.get('/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { query } = require('../config/database');
        
        // Récupérer la session
        const sessions = await query(
            'SELECT * FROM chat_sessions WHERE session_id = ?',
            [sessionId]
        );
        
        if (sessions.length === 0) {
            return res.json({ messages: [], session: null });
        }
        
        // Récupérer les messages
        const messages = await query(
            'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
        
        res.json({ 
            messages: messages,
            session: sessions[0]
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/support/save-message - Sauvegarder un message
router.post('/save-message', async (req, res) => {
    try {
        const { sessionId, sender, message, userName, userEmail } = req.body;
        const { query } = require('../config/database');
        
        // Vérifier si la session existe, sinon la créer
        const existingSession = await query(
            'SELECT * FROM chat_sessions WHERE session_id = ?',
            [sessionId]
        );
        
        if (existingSession.length === 0) {
            await query(
                'INSERT INTO chat_sessions (session_id, user_name, user_email) VALUES (?, ?, ?)',
                [sessionId, userName || null, userEmail || null]
            );
        } else if (userName || userEmail) {
            // Mettre à jour les infos utilisateur si fournies
            await query(
                'UPDATE chat_sessions SET user_name = COALESCE(?, user_name), user_email = COALESCE(?, user_email) WHERE session_id = ?',
                [userName, userEmail, sessionId]
            );
        }
        
        // Sauvegarder le message
        await query(
            'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)',
            [sessionId, sender, message]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/support/sessions - Lister toutes les sessions (admin)
router.get('/sessions', async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        const sessions = await query(`
            SELECT cs.*, COUNT(cm.id) as message_count,
                   (SELECT message FROM chat_messages WHERE session_id = cs.id ORDER BY created_at ASC LIMIT 1) as first_message,
                   MAX(cm.created_at) as last_message_date
            FROM chat_sessions cs
            LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
            GROUP BY cs.id
            ORDER BY last_activity DESC
        `);
        
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/support - Main support endpoint
router.post('/', upload.single('screenshot'), async (req, res) => {
    try {
        const { message } = req.body;
        const screenshotFile = req.file;
        
        // Si pas de message mais une capture, créer un message par défaut
        let userMessage = message;
        if (!userMessage && screenshotFile) {
            userMessage = "Analyse de capture d'écran";
            console.log('📸 Capture reçue, analyse en cours...');
        }
        
        if (!userMessage && !screenshotFile) {
            return res.status(400).json({ error: 'Message ou capture requis' });
        }
        
        const screenshotPath = screenshotFile ? screenshotFile.path : null;
        
        const result = await chatbotService.processUserMessage(userMessage, screenshotPath);
        
        res.json(result);
    } catch (error) {
        console.error('Support endpoint error:', error);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

// POST /api/support/capture - Endpoint for screenshot capture
router.post('/capture', upload.single('screenshot'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No screenshot provided' });
        }
        
        res.json({
            success: true,
            screenshotPath: req.file.path,
            message: 'Screenshot captured and uploaded successfully'
        });
    } catch (error) {
        console.error('Capture error:', error);
        res.status(500).json({ error: 'Failed to capture screenshot' });
    }
});

// GET /api/support/problems - Get all problems (for admin)
router.get('/problems', async (req, res) => {
    try {
        const { query } = require('../config/database');
        const problems = await query('SELECT * FROM problems ORDER BY created_at DESC');
        res.json(problems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/support/download/:filename - Télécharger un PDF
router.get('/download/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(process.env.UPLOAD_DIR || './uploads', filename);
        
        if (fs.existsSync(filepath)) {
            res.download(filepath, filename);
        } else {
            res.status(404).json({ error: 'Fichier non trouvé' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
});

// GET /api/support/status - Check support system status
router.get('/status', (req, res) => {
    res.json({
        status: 'operational',
        version: '1.0.0',
        features: ['keyword-matching', 'ocr', 'ticket-creation']
    });
});

module.exports = router;