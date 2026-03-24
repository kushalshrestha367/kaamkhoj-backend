const express = require('express');
const auth = require('../middleware/auth');
const Job = require('../models/Job');
const User = require('../models/User'); 
const Notification = require('../models/Notification'); 
const router = express.Router();

// Create job (Client only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can post jobs' });
    }

    const job = new Job({
      ...req.body,
      client: req.user.userId
    });

    await job.save();
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all jobs 
router.get('/', async (req, res) => {
  try {
    const { category, skills, minBudget, maxBudget, search } = req.query;
    let filter = { status: 'open' };

    if (category) filter.category = category;
    if (skills) filter.skillsRequired = { $in: skills.split(',') };
    if (minBudget || maxBudget) {
      filter.budget = {};
      if (minBudget) filter.budget.$gte = parseInt(minBudget);
      if (maxBudget) filter.budget.$lte = parseInt(maxBudget);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(filter)
      .populate('client', 'name company profilePicture')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'name company profilePicture email')
      .populate({
        path: 'applications.freelancer',
        select: 'name email profilePicture skills averageRating totalReviews hourlyRate bio'
      })
      .lean();
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (job.applications) {
      job.applications = job.applications.map(app => ({
        ...app,
        freelancer: app.freelancer || { name: 'Unknown', email: '' },
        bidAmount: app.bidAmount || 0,
        estimatedTime: app.estimatedTime || 'Not specified',
        proposal: app.proposal || 'No proposal provided',
        status: app.status || 'pending'
      }));
    }
    
    console.log(`✅ Job ${job._id} returned with ${job.applications?.length || 0} applications`);
    
    res.json(job);
  } catch (error) {
    console.error('❌ Error fetching job:', error);
    res.status(500).json({ message: error.message });
  }
});

// Apply to job (Freelancer only)
router.post('/:id/apply', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can apply to jobs' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if already applied
    const alreadyApplied = job.applications.find(
      app => app.freelancer.toString() === req.user.userId
    );

    if (alreadyApplied) {
      return res.status(400).json({ message: 'You have already applied to this job' });
    }

    // Get freelancer details for notification
    const freelancer = await User.findById(req.user.userId).select('name email');
    
    // Add application
    job.applications.push({
      freelancer: req.user.userId,
      proposal: req.body.proposal,
      bidAmount: req.body.bidAmount,
      estimatedTime: req.body.estimatedTime,
      status: 'pending',
      submittedAt: new Date()
    });

    await job.save();
    
    const io = req.app.get('io');
    if (io) {
      const notification = new Notification({
        user: job.client,
        type: 'job_application',
        title: 'New Job Application',
        message: `${freelancer.name} applied for your job "${job.title}"`,
        relatedEntity: {
          type: 'job',
          id: job._id
        },
        priority: 'high'
      });
      await notification.save();
      
      // Emit socket event to client
      io.to(`user_${job.client}`).emit('notification', {
        _id: notification._id,
        type: 'job_application',
        title: 'New Job Application',
        message: `${freelancer.name} applied for your job "${job.title}"`,
        createdAt: notification.createdAt,
        jobId: job._id,
        jobTitle: job.title
      });
      
      console.log(`Notification sent to client ${job.client} about new application`);
    }
    await job.populate('applications.freelancer', 'name email profilePicture');
    
    res.json({ 
      success: true,
      message: 'Application submitted successfully', 
      job 
    });
  } catch (error) {
    console.error('Error applying to job:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get jobs posted by current client
router.get('/client/my-jobs', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can access this endpoint' });
    }

    const jobs = await Job.find({ client: req.user.userId })
      .populate('applications.freelancer', 'name skills profilePicture')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update job status (Client only)
router.put('/:id/status', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can update job status' });
    }

    const job = await Job.findOne({
      _id: req.params.id,
      client: req.user.userId
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    job.status = req.body.status;
    await job.save();

    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update application status (Client only)
router.put('/:jobId/applications/:applicationId', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can update application status' });
    }

    const job = await Job.findOne({
      _id: req.params.jobId,
      client: req.user.userId
    }).populate('applications.freelancer', 'name email');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const application = job.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const previousStatus = application.status;
    application.status = req.body.status;
    if (req.body.status === 'accepted') {
      job.hiredFreelancer = application.freelancer._id;
      job.status = 'in-progress';
      job.applications.forEach(app => {
        if (app._id.toString() !== req.params.applicationId) {
          app.status = 'rejected';
        }
      });
    }
    await job.save();
    
    // Send notification to freelancer about decision
    const io = req.app.get('io');
    if (io && application.freelancer) {
      const notification = new Notification({
        user: application.freelancer._id,
        type: req.body.status === 'accepted' ? 'application_accepted' : 'application_rejected',
        title: req.body.status === 'accepted' ? '🎉 Proposal Accepted!' : 'Proposal Update',
        message: req.body.status === 'accepted' 
          ? `Congratulations! Your proposal for "${job.title}" has been accepted! The client will contact you soon.`
          : `Your proposal for "${job.title}" was not selected. Don't give up! Keep applying for other opportunities.`,
        relatedEntity: {
          type: 'job',
          id: job._id
        },
        priority: req.body.status === 'accepted' ? 'high' : 'medium'
      });
      await notification.save();
      
      // Emit to freelancer
      io.to(`user_${application.freelancer._id}`).emit(
        req.body.status === 'accepted' ? 'proposal-accepted' : 'proposal-rejected',
        {
          notificationId: notification._id,
          jobId: job._id,
          jobTitle: job.title,
          freelancerId: application.freelancer._id,
          freelancerName: application.freelancer.name,
          status: req.body.status
        }
      );
      
      console.log(`Notification sent to freelancer ${application.freelancer._id}: ${req.body.status}`);
    }
    
    // Populate the response
    await job.populate('applications.freelancer', 'name email profilePicture skills averageRating');
    
    res.json({ 
      success: true,
      message: `Application ${req.body.status} successfully`,
      job 
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;