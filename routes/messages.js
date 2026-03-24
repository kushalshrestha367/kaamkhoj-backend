// const express = require('express');
// const auth = require('../middleware/auth');
// const Conversation = require('../models/Conversation');
// const Message = require('../models/Message');
// const router = express.Router();

// // Get unread message count
// router.get('/unread-count', auth, async (req, res) => {
//   try {
//     const count = await Message.countDocuments({
//       receiver: req.user.userId,
//       isRead: false
//     });

//     res.json({ unreadCount: count });
//   } catch (error) {
//     console.error('Error fetching unread count:', error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get conversations for user
// router.get('/conversations', auth, async (req, res) => {
//   try {
//     const conversations = await Conversation.find({
//       participants: req.user.userId
//     })
//     .populate('participants', 'name profilePicture userType')
//     .populate('job', 'title')
//     .populate('lastMessage')
//     .sort({ lastMessageAt: -1 });

//     res.json(conversations);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get messages for a conversation
// router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
//   try {
//     const conversation = await Conversation.findOne({
//       _id: req.params.conversationId,
//       participants: req.user.userId
//     });

//     if (!conversation) {
//       return res.status(404).json({ message: 'Conversation not found' });
//     }

//     const messages = await Message.find({
//       conversation: req.params.conversationId
//     })
//     .populate('sender', 'name profilePicture userType')
//     .sort({ createdAt: 1 });

//     // Mark messages as read
//     await Message.updateMany(
//       {
//         conversation: req.params.conversationId,
//         receiver: req.user.userId,
//         isRead: false
//       },
//       {
//         isRead: true,
//         readAt: new Date()
//       }
//     );

//     res.json(messages);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Send a message
// router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
//   try {
//     const { content } = req.body;
//     const conversation = await Conversation.findOne({
//       _id: req.params.conversationId,
//       participants: req.user.userId
//     });

//     if (!conversation) {
//       return res.status(404).json({ message: 'Conversation not found' });
//     }

//     // Find the other participant
//     const receiver = conversation.participants.find(
//       participant => participant.toString() !== req.user.userId
//     );

//     const message = new Message({
//       conversation: req.params.conversationId,
//       sender: req.user.userId,
//       receiver: receiver,
//       content: content
//     });

//     await message.save();

//     // Update conversation last message
//     conversation.lastMessage = message._id;
//     conversation.lastMessageAt = new Date();
//     await conversation.save();

//     await message.populate('sender', 'name profilePicture userType');

//     res.status(201).json(message);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Start a new conversation
// router.post('/conversations', auth, async (req, res) => {
//   try {
//     const { participantId, jobId } = req.body;

//     // Check if conversation already exists
//     let conversation = await Conversation.findOne({
//       participants: { $all: [req.user.userId, participantId] },
//       job: jobId
//     })
//     .populate('participants', 'name profilePicture userType')
//     .populate('job', 'title');

//     if (!conversation) {
//       conversation = new Conversation({
//         participants: [req.user.userId, participantId],
//         job: jobId
//       });
//       await conversation.save();
//       await conversation.populate('participants', 'name profilePicture userType');
//       await conversation.populate('job', 'title');
//     }

//     res.json(conversation);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });
// module.exports = router;


const express = require('express');
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const router = express.Router();

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user.userId,
      isRead: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get conversations for user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.userId
    })
    .populate('participants', 'name profilePicture userType')
    .populate('job', 'title')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user.userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await Message.find({
      conversation: req.params.conversationId
    })
    .populate('sender', 'name profilePicture userType')
    .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: req.params.conversationId,
        receiver: req.user.userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: error.message });
  }
});

// Send a message
router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user.userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Find the other participant
    const receiverId = conversation.participants.find(
      participant => participant.toString() !== req.user.userId
    );

    // Get sender details for notification
    const sender = await User.findById(req.user.userId).select('name profilePicture');

    const message = new Message({
      conversation: req.params.conversationId,
      sender: req.user.userId,
      receiver: receiverId,
      content: content
    });

    await message.save();

    // Update conversation last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await message.populate('sender', 'name profilePicture userType');

    // Get io instance
    const io = req.app.get('io');
    
    // Emit real-time message to receiver
    if (io) {
      io.to(`user_${receiverId}`).emit('new-message', {
        messageId: message._id,
        conversationId: conversation._id,
        senderId: req.user.userId,
        senderName: sender.name,
        senderProfilePicture: sender.profilePicture,
        receiverId: receiverId,
        content: content,
        preview: content.substring(0, 50),
        createdAt: message.createdAt
      });

      // Also emit to sender for immediate update
      io.to(`user_${req.user.userId}`).emit('message-sent', {
        messageId: message._id,
        conversationId: conversation._id,
        senderId: req.user.userId,
        content: content,
        createdAt: message.createdAt
      });

      // Create notification for receiver
      const notification = new Notification({
        user: receiverId,
        type: 'message',
        title: 'New Message',
        message: `${sender.name} sent you a message`,
        relatedEntity: {
          type: 'message',
          id: message._id
        },
        priority: 'high'
      });
      await notification.save();

      // Emit notification to receiver
      io.to(`user_${receiverId}`).emit('notification', {
        _id: notification._id,
        type: 'message',
        title: 'New Message',
        message: `${sender.name} sent you a message`,
        createdAt: notification.createdAt,
        isRead: false
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
});

// Start a new conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const { participantId, jobId } = req.body;

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.userId, participantId] },
      job: jobId
    })
    .populate('participants', 'name profilePicture userType')
    .populate('job', 'title');

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user.userId, participantId],
        job: jobId
      });
      await conversation.save();
      await conversation.populate('participants', 'name profilePicture userType');
      await conversation.populate('job', 'title');
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark a message as read
router.put('/messages/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.receiver.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    // Emit read receipt
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.sender}`).emit('message-read', {
        messageId: message._id,
        conversationId: message.conversation,
        readAt: message.readAt
      });
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ message: error.message });
  }
});
// Mark a message as read
router.put('/messages/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.receiver.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    // Emit read receipt
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.sender}`).emit('message-read', {
        messageId: message._id,
        conversationId: message.conversation,
        readAt: message.readAt
      });
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get unread message count for a specific conversation
router.get('/conversations/:conversationId/unread-count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      conversation: req.params.conversationId,
      receiver: req.user.userId,
      isRead: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching conversation unread count:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;