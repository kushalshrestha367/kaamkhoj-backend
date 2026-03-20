const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'job_application',
      'application_accepted',
      'application_rejected',
      'job_offer',
      'message',
      'payment_received',
      'payment_sent',
      'review_received',
      'system_alert',
      'job_posted'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedEntity: {
    type: {
      type: String,
      enum: ['job', 'application', 'message', 'user', 'payment']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

// Static method to create common notification types
notificationSchema.statics.createJobApplicationNotification = function(userId, jobTitle, jobId, applicationId) {
  return this.create({
    user: userId,
    type: 'job_application',
    title: 'New Job Application',
    message: `You have a new application for your job "${jobTitle}"`,
    relatedEntity: {
      type: 'application',
      id: applicationId
    }
  });
};

notificationSchema.statics.createApplicationAcceptedNotification = function(userId, jobTitle, jobId) {
  return this.create({
    user: userId,
    type: 'application_accepted',
    title: 'Application Accepted!',
    message: `Your application for "${jobTitle}" has been accepted!`,
    relatedEntity: {
      type: 'job',
      id: jobId
    },
    priority: 'high'
  });
};

notificationSchema.statics.createMessageNotification = function(userId, senderName, messageId) {
  return this.create({
    user: userId,
    type: 'message',
    title: 'New Message',
    message: `You have a new message from ${senderName}`,
    relatedEntity: {
      type: 'message',
      id: messageId
    }
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;