const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/admin/problems - List all problems
router.get('/problems', async (req, res) => {
    try {
        const problems = await query('SELECT * FROM problems ORDER BY created_at DESC');
        res.json(problems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/problems - Add new problem
router.post('/problems', async (req, res) => {
    try {
        const { title, keywords, error_code, description, solution, category } = req.body;
        
        if (!title || !keywords || !solution) {
            return res.status(400).json({ error: 'Title, keywords, and solution are required' });
        }
        
        const result = await query(
            `INSERT INTO problems (title, keywords, error_code, description, solution, category)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, keywords, error_code, description, solution, category]
        );
        
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/problems/:id - Update problem
router.put('/problems/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, keywords, error_code, description, solution, category } = req.body;
        
        await query(
            `UPDATE problems 
             SET title = ?, keywords = ?, error_code = ?, description = ?, solution = ?, category = ?
             WHERE id = ?`,
            [title, keywords, error_code, description, solution, category, id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/problems/:id - Delete problem
router.delete('/problems/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM problems WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/logs - View support logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await query(`
            SELECT l.*, p.title as matched_problem_title, t.status as ticket_status
            FROM support_logs l
            LEFT JOIN problems p ON l.matched_problem_id = p.id
            LEFT JOIN tickets t ON l.ticket_id = t.id
            ORDER BY l.created_at DESC
            LIMIT 100
        `);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/stats - Get system statistics
router.get('/stats', async (req, res) => {
    try {
        const [totalTickets] = await query('SELECT COUNT(*) as count FROM tickets');
        const [openTickets] = await query('SELECT COUNT(*) as count FROM tickets WHERE status = "open"');
        const [totalProblems] = await query('SELECT COUNT(*) as count FROM problems');
        const [avgResponseTime] = await query('SELECT AVG(response_time_ms) as avg FROM support_logs');
        
        res.json({
            totalTickets: totalTickets.count,
            openTickets: openTickets.count,
            totalProblems: totalProblems.count,
            avgResponseTime: avgResponseTime.avg || 0,
            systemHealth: 'good'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;