const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');
const router = express.Router();


router.post('/agent/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingAgent = await Agent.findOne({ username });
    if (existingAgent) {
      return res.status(400).json({ error: 'Agent already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const agent = new Agent({
      username,
      password: hashedPassword
    });

    await agent.save();

    res.status(201).json({ message: 'Agent registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


router.post('/agent/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const agent = await Agent.findOne({ username });
    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { agentId: agent._id, username: agent.username },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      agent: {
        id: agent._id,
        username: agent.username,
        isOnline: agent.isOnline
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/agent/status', async (req, res) => {
  try {
    const agents = await Agent.find({}, 'username isOnline lastSeen');
    res.json({ agents });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;