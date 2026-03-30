const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/tickets - List all tickets
router.get('/', async (req, res) => {
    try {
        const { status, priority } = req.query;
        let sql = 'SELECT * FROM tickets';
        const params = [];
        
        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const tickets = await query(sql, params);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tickets/:id - Get single ticket
router.get('/:id', async (req, res) => {
    try {
        const tickets = await query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
        if (tickets.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(tickets[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tickets/:id - Update ticket
router.put('/:id', async (req, res) => {
    try {
        const { status, priority, resolved_by, resolution_notes } = req.body;
        
        await query(
            `UPDATE tickets 
             SET status = ?, priority = ?, resolved_by = ?, resolution_notes = ?
             WHERE id = ?`,
            [status, priority, resolved_by, resolution_notes, req.params.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/tickets/:id - Delete ticket
router.delete('/:id', async (req, res) => {
    try {
        await query('DELETE FROM tickets WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;