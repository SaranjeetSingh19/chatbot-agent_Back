const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    const agent = await Agent.findById(decoded.agentId);
    
    if (!agent) {
      return next(new Error('Agent not found'));
    }

    socket.agentData = {
      id: agent._id,
      username: agent.username
    };
    
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication error'));
  }
};

module.exports = authenticateSocket;