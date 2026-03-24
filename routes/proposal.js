// const express = require('express');
// const auth = require('../middleware/auth');
// const Proposal = require('../models/Proposal');
// const Job = require('../models/Job');
// const router = express.Router();

// // Get proposals for a freelancer
// router.get('/my-proposals', auth, async (req, res) => {
//   try {
//     if (req.user.userType !== 'freelancer') {
//       return res.status(403).json({ message: 'Only freelancers can access proposals' });
//     }

//     const proposals = await Proposal.find({ freelancer: req.user.userId })
//       .populate('job', 'title budget client status')
//       .populate('job.client', 'name company')
//       .sort({ createdAt: -1 });

//     res.json(proposals);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get proposals for a job (Client only)
// router.get('/job/:jobId', auth, async (req, res) => {
//   try {
//     if (req.user.userType !== 'client') {
//       return res.status(403).json({ message: 'Only clients can access job proposals' });
//     }

//     // Verify the job belongs to the client
//     const job = await Job.findOne({
//       _id: req.params.jobId,
//       client: req.user.userId
//     });

//     if (!job) {
//       return res.status(404).json({ message: 'Job not found or access denied' });
//     }

//     const proposals = await Proposal.find({ job: req.params.jobId })
//       .populate('freelancer', 'name skills profilePicture averageRating')
//       .sort({ createdAt: -1 });

//     res.json(proposals);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Update proposal status (Client only)
// router.put('/:proposalId/status', auth, async (req, res) => {
//   try {
//     if (req.user.userType !== 'client') {
//       return res.status(403).json({ message: 'Only clients can update proposal status' });
//     }

//     const proposal = await Proposal.findById(req.params.proposalId)
//       .populate('job');

//     if (!proposal) {
//       return res.status(404).json({ message: 'Proposal not found' });
//     }

//     // Verify the job belongs to the client
//     if (proposal.job.client.toString() !== req.user.userId) {
//       return res.status(403).json({ message: 'Access denied' });
//     }

//     proposal.status = req.body.status;
//     await proposal.save();

//     // If accepted, update the job
//     if (req.body.status === 'accepted') {
//       await Job.findByIdAndUpdate(proposal.job._id, {
//         hiredFreelancer: proposal.freelancer,
//         status: 'in-progress'
//       });
//     }

//     res.json(proposal);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// module.exports = router;

const express = require('express');
const auth = require('../middleware/auth');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const router = express.Router();

// Get proposals for a freelancer
router.get('/my-proposals', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can access proposals' });
    }

    // Find all jobs where this freelancer has applied
    const jobs = await Job.find({
      'applications.freelancer': req.user.userId
    })
    .populate('client', 'name company profilePicture')
    .select('title budget budgetType status client applications')
    .sort({ createdAt: -1 });

    // Extract applications for this freelancer
    const proposals = jobs.map(job => {
      const application = job.applications.find(
        app => app.freelancer.toString() === req.user.userId
      );
      return {
        _id: application._id,
        job: {
          _id: job._id,
          title: job.title,
          budget: job.budget,
          budgetType: job.budgetType,
          status: job.status,
          client: job.client
        },
        proposal: application.proposal,
        bidAmount: application.bidAmount,
        estimatedTime: application.estimatedTime,
        status: application.status,
        createdAt: application.submittedAt,
        updatedAt: application.submittedAt
      };
    });

    res.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get proposals for a job (Client only)
router.get('/job/:jobId', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can access job proposals' });
    }

    // Verify the job belongs to the client
    const job = await Job.findOne({
      _id: req.params.jobId,
      client: req.user.userId
    }).populate('applications.freelancer', 'name email profilePicture skills averageRating');

    if (!job) {
      return res.status(404).json({ message: 'Job not found or access denied' });
    }

    const proposals = job.applications.map(app => ({
      _id: app._id,
      freelancer: app.freelancer,
      proposal: app.proposal,
      bidAmount: app.bidAmount,
      estimatedTime: app.estimatedTime,
      status: app.status,
      submittedAt: app.submittedAt
    }));

    res.json(proposals);
  } catch (error) {
    console.error('Error fetching job proposals:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update proposal status (Client only)
// router.put('/:proposalId/status', auth, async (req, res) => {
//   try {
//     if (req.user.userType !== 'client') {
//       return res.status(403).json({ message: 'Only clients can update proposal status' });
//     }

//     const { status } = req.body;
    
//     // Find the job containing this proposal
//     const job = await Job.findOne({
//       'applications._id': req.params.proposalId
//     }).populate('applications.freelancer', 'name email');

//     if (!job) {
//       return res.status(404).json({ message: 'Proposal not found' });
//     }

//     // Verify the job belongs to the client
//     if (job.client.toString() !== req.user.userId) {
//       return res.status(403).json({ message: 'Access denied' });
//     }

//     // Find and update the application
//     const application = job.applications.id(req.params.proposalId);
//     if (!application) {
//       return res.status(404).json({ message: 'Application not found' });
//     }

//     application.status = status;
    
//     // If accepting, update job status and hired freelancer
//     if (status === 'accepted') {
//       job.hiredFreelancer = application.freelancer._id;
//       job.status = 'in-progress';
      
//       // Reject all other applications
//       job.applications.forEach(app => {
//         if (app._id.toString() !== req.params.proposalId) {
//           app.status = 'rejected';
//         }
//       });
//     }

//     await job.save();

//     // Get io instance
//     const io = req.app.get('io');
    
//     // Send notification to freelancer
//     if (io) {
//       const notificationData = {
//         userId: application.freelancer._id,
//         type: status === 'accepted' ? 'application_accepted' : 'application_rejected',
//         title: status === 'accepted' ? '🎉 Proposal Accepted!' : 'Proposal Update',
//         message: status === 'accepted' 
//           ? `Congratulations! Your proposal for "${job.title}" has been accepted!`
//           : `Your proposal for "${job.title}" was not selected. Keep applying!`,
//         jobId: job._id,
//         jobTitle: job.title
//       };

//       // Create notification in database
//       const notification = new Notification({
//         user: application.freelancer._id,
//         type: notificationData.type,
//         title: notificationData.title,
//         message: notificationData.message,
//         relatedEntity: {
//           type: 'job',
//           id: job._id
//         },
//         priority: status === 'accepted' ? 'high' : 'medium'
//       });
//       await notification.save();

//       // Emit socket event
//       io.to(`user_${application.freelancer._id}`).emit(
//         status === 'accepted' ? 'proposal-accepted' : 'proposal-rejected',
//         {
//           notificationId: notification._id,
//           jobId: job._id,
//           jobTitle: job.title,
//           freelancerId: application.freelancer._id,
//           userId: application.freelancer._id,
//           status: status
//         }
//       );
//     }

//     res.json({
//       message: `Proposal ${status} successfully`,
//       proposal: {
//         _id: application._id,
//         status: application.status,
//         jobId: job._id,
//         jobTitle: job.title
//       }
//     });
//   } catch (error) {
//     console.error('Error updating proposal status:', error);
//     res.status(500).json({ message: error.message });
//   }
// });
// Update proposal status (Client only)
router.put('/:proposalId/status', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can update proposal status' });
    }

    const { status } = req.body;
    
    // Find the job containing this proposal
    const job = await Job.findOne({
      'applications._id': req.params.proposalId
    }).populate('applications.freelancer', 'name email');

    if (!job) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    // Verify the job belongs to the client
    if (job.client.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find and update the application
    const application = job.applications.id(req.params.proposalId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    
    // If accepting, update job status and hired freelancer
    if (status === 'accepted') {
      job.hiredFreelancer = application.freelancer._id;
      job.status = 'in-progress';
      
      // Reject all other applications
      job.applications.forEach(app => {
        if (app._id.toString() !== req.params.proposalId) {
          app.status = 'rejected';
        }
      });
    }

    await job.save();

    // Get io instance and send notification
    const io = req.app.get('io');
    const Notification = require('../models/Notification');
    
    if (io) {
      const notification = new Notification({
        user: application.freelancer._id,
        type: status === 'accepted' ? 'application_accepted' : 'application_rejected',
        title: status === 'accepted' ? '🎉 Proposal Accepted!' : 'Proposal Update',
        message: status === 'accepted' 
          ? `Congratulations! Your proposal for "${job.title}" has been accepted!`
          : `Your proposal for "${job.title}" was not selected. Keep applying!`,
        relatedEntity: {
          type: 'job',
          id: job._id
        },
        priority: status === 'accepted' ? 'high' : 'medium'
      });
      await notification.save();

      // Emit to freelancer
      io.to(`user_${application.freelancer._id}`).emit(
        status === 'accepted' ? 'proposal-accepted' : 'proposal-rejected',
        {
          notificationId: notification._id,
          jobId: job._id,
          jobTitle: job.title,
          freelancerId: application.freelancer._id,
          status: status
        }
      );
    }

    res.json({
      success: true,
      message: `Proposal ${status} successfully`,
      proposal: {
        _id: application._id,
        status: application.status,
        jobId: job._id,
        jobTitle: job.title
      }
    });
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;