const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

//updating lastSeen before saving
agentSchema.pre('save', function(next) {
  if (this.isModified('isOnline')) {
    this.lastSeen = new Date();
  }
  next();
});

//method to set agent online
agentSchema.methods.setOnline = function(socketId) {
  this.isOnline = true;
  this.socketId = socketId;
  this.lastSeen = new Date();
  return this.save();
};

//method to set agent offline
agentSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.socketId = null;
  this.lastSeen = new Date();
  return this.save();
};

//method to find online agents
agentSchema.statics.findOnlineAgents = function() {
  return this.find({ isOnline: true });
};

module.exports = mongoose.model('Agent', agentSchema);