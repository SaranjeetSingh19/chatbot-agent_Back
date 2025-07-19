const express = require('express');
const Message = require('../models/Message');
const router = express.Router();


router.get('/history', async (req, res) => {
  try {
    const { user, agent } = req.query;
    
    if (!user || !agent) {
      return res.status(400).json({ error: 'User and agent parameters are required' });
    }

    const messages = await Message.find({
      $or: [
        { sender: user, receiver: agent },
        { sender: agent, receiver: user }
      ]
    }).sort({ timestamp: 1 });

    res.json({ messages });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


router.post('/mark-read', async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $set: { isRead: true } }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;