const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  senderType: {
    type: String,
    required: true,
    enum: ['agent', 'user']
  },
  receiver: {
    type: String,
    required: true
  },
  receiverType: {
    type: String,
    required: true,
    enum: ['agent', 'user']
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);