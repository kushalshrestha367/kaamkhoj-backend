const express = require('express');
const auth = require('../middleware/auth');
const Job = require('../models/Job');
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

// Get all jobs (with filters)
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

// Get single job
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'name company profilePicture')
      .populate('applications.freelancer', 'name skills profilePicture');
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json(job);
  } catch (error) {
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

    job.applications.push({
      freelancer: req.user.userId,
      proposal: req.body.proposal,
      bidAmount: req.body.bidAmount,
      estimatedTime: req.body.estimatedTime,
      status: 'pending'
    });

    await job.save();
    
    // Populate the application data for response
    await job.populate('applications.freelancer', 'name email profilePicture');
    
    res.json({ message: 'Application submitted successfully', job });
  } catch (error) {
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
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const application = job.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = req.body.status;
    
    // If accepting an application, set the hired freelancer
    if (req.body.status === 'accepted') {
      job.hiredFreelancer = application.freelancer;
      job.status = 'in-progress';
    }

    await job.save();
    
    // Populate the response
    await job.populate('applications.freelancer', 'name email profilePicture');
    
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });c
  }
});

module.exports = router;