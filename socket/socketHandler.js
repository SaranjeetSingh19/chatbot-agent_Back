const Agent = require('../models/Agent');
const User = require('../models/User');
const Message = require('../models/Message');
const authenticateSocket = require('../middleware/authSocket');

module.exports = (io) => {
  const agentNamespace = io.of('/agent');
  
  agentNamespace.use(authenticateSocket);
  
  agentNamespace.on('connection', async (socket) => {
    try {
      const { id: agentId, username } = socket.agentData;
      
      await Agent.findByIdAndUpdate(agentId, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: new Date()
      });
      
      console.log(`Agent ${username} connected`);
      
      const userMessages = await Message.find({
        $or: [
          { receiver: username, receiverType: 'agent' },
          { sender: username, senderType: 'agent' }
        ]
      }).sort({ timestamp: -1 });
      
      const userList = [];
      const seenUsers = new Set();
      
      for (const msg of userMessages) {
        const userUsername = msg.senderType === 'user' ? msg.sender : msg.receiver;
        if (!seenUsers.has(userUsername)) {
          seenUsers.add(userUsername);
          userList.push({
            username: userUsername,
            lastMessage: msg.content,
            timestamp: msg.timestamp
          });
        }
      }
      
      socket.emit('initialUserList', { users: userList });
      
      io.of('/user').emit('agentStatusChanged', {
        agentId,
        username,
        isOnline: true,
        status: 'live'
      });
      
      socket.on('sendMessage', async (data) => {
        try {
          const { receiverUsername, content } = data;
          
          if (!receiverUsername || !content || content.trim() === '') {
            socket.emit('error', { message: 'Invalid message data' });
            return;
          }
          
          const message = new Message({
            sender: username,
            senderType: 'agent',
            receiver: receiverUsername,
            receiverType: 'user',
            content: content.trim()
          });
          
          await message.save();
          
          const userSockets = await io.of('/user').fetchSockets();
          const targetUserSocket = userSockets.find(s => s.userData?.username === receiverUsername);
          
          if (targetUserSocket) {
            targetUserSocket.emit('messageReceived', {
              id: message._id,
              sender: username,
              senderType: 'agent',
              content: content.trim(),
              timestamp: message.timestamp
            });
          }
          
          socket.emit('messageSent', {
            id: message._id,
            receiver: receiverUsername,
            content: content.trim(),
            timestamp: message.timestamp
          });
          
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });
      
      socket.on('typing', (data) => {
        const { receiverUsername, isTyping } = data;
        
        const userSockets = io.of('/user').fetchSockets();
        userSockets.then(sockets => {
          const targetUserSocket = sockets.find(s => s.userData?.username === receiverUsername);
          if (targetUserSocket) {
            targetUserSocket.emit('agentTyping', {
              agentUsername: username,
              isTyping
            });
          }
        });
      });
      
      socket.on('disconnect', async () => {
        try {
          await Agent.findByIdAndUpdate(agentId, {
            isOnline: false,
            socketId: null,
            lastSeen: new Date()
          });
          
          console.log(`Agent ${username} disconnected`);
          
          io.of('/user').emit('agentStatusChanged', {
            agentId,
            username,
            isOnline: false,
            status: 'offline'
          });
          
        } catch (error) {
          console.error('Agent disconnect error:', error);
        }
      });
      
    } catch (error) {
      console.error('Agent connection error:', error);
      socket.disconnect();
    }
  });
  
  const userNamespace = io.of('/user');
  
  userNamespace.on('connection', async (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('identifyUser', async (data) => {
      try {
        const { username } = data;
        
        if (!username || username.trim() === '') {
          socket.emit('error', { message: 'Username is required' });
          return;
        }
        
        socket.userData = { username: username.trim() };
        
        await User.findOneAndUpdate(
          { username: username.trim() },
          { 
            socketId: socket.id,
            isOnline: true
          },
          { upsert: true }
        );
        
        const agents = await Agent.find({}, 'username isOnline lastSeen');
        
        socket.emit('userIdentified', {
          username: username.trim(),
          agents: agents.map(agent => ({
            id: agent._id,
            username: agent.username,
            isOnline: agent.isOnline,
            status: agent.isOnline ? 'live' : 'offline',
            lastSeen: agent.lastSeen
          }))
        });
        
        console.log(`User ${username.trim()} identified`);
        
      } catch (error) {
        console.error('User identification error:', error);
        socket.emit('error', { message: 'Failed to identify user' });
      }
    });
    
    socket.on('sendMessage', async (data) => {
      try {
        const { receiverUsername, content } = data;
        const senderUsername = socket.userData?.username;
        
        if (!senderUsername) {
          socket.emit('error', { message: 'User not identified' });
          return;
        }
        
        if (!receiverUsername || !content || content.trim() === '') {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }
        
        const agent = await Agent.findOne({ username: receiverUsername });
        if (!agent) {
          socket.emit('error', { message: 'Agent not found' });
          return;
        }
        
        const message = new Message({
          sender: senderUsername,
          senderType: 'user',
          receiver: receiverUsername,
          receiverType: 'agent',
          content: content.trim()
        });
        
        await message.save();
        
        if (agent.isOnline && agent.socketId) {
          const agentSockets = await agentNamespace.fetchSockets();
          const targetAgentSocket = agentSockets.find(s => s.agentData?.username === receiverUsername);
          
          if (targetAgentSocket) {
            targetAgentSocket.emit('messageReceived', {
              id: message._id,
              sender: senderUsername,
              senderType: 'user',
              content: content.trim(),
              timestamp: message.timestamp
            });
            
            targetAgentSocket.emit('newUserMessage', {
              username: senderUsername,
              lastMessage: content.trim(),
              timestamp: message.timestamp
            });
          }
        }
        
        socket.emit('messageSent', {
          id: message._id,
          receiver: receiverUsername,
          content: content.trim(),
          timestamp: message.timestamp,
          delivered: agent.isOnline
        });
        
      } catch (error) {
        console.error('User send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    socket.on('typing', (data) => {
      const { receiverUsername, isTyping } = data;
      const senderUsername = socket.userData?.username;
      
      if (!senderUsername) return;
      
      const agentSockets = agentNamespace.fetchSockets();
      agentSockets.then(sockets => {
        const targetAgentSocket = sockets.find(s => s.agentData?.username === receiverUsername);
        if (targetAgentSocket) {
          targetAgentSocket.emit('userTyping', {
            userUsername: senderUsername,
            isTyping
          });
        }
      });
    });
    
    socket.on('disconnect', async () => {
      try {
        const username = socket.userData?.username;
        if (username) {
          await User.findOneAndUpdate(
            { username },
            { 
              isOnline: false,
              socketId: null
            }
          );
          console.log(`User ${username} disconnected`);
        }
      } catch (error) {
        console.error('User disconnect error:', error);
      }
    });
  });
};