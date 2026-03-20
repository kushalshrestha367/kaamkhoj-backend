const express = require('express');
const auth = require('../middleware/auth');
const Proposal = require('../models/Proposal');
const Job = require('../models/Job');
const router = express.Router();

// Get proposals for a freelancer
router.get('/my-proposals', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can access proposals' });
    }

    const proposals = await Proposal.find({ freelancer: req.user.userId })
      .populate('job', 'title budget client status')
      .populate('job.client', 'name company')
      .sort({ createdAt: -1 });

    res.json(proposals);
  } catch (error) {
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
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found or access denied' });
    }

    const proposals = await Proposal.find({ job: req.params.jobId })
      .populate('freelancer', 'name skills profilePicture averageRating')
      .sort({ createdAt: -1 });

    res.json(proposals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update proposal status (Client only)
router.put('/:proposalId/status', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can update proposal status' });
    }

    const proposal = await Proposal.findById(req.params.proposalId)
      .populate('job');

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    // Verify the job belongs to the client
    if (proposal.job.client.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    proposal.status = req.body.status;
    await proposal.save();

    // If accepted, update the job
    if (req.body.status === 'accepted') {
      await Job.findByIdAndUpdate(proposal.job._id, {
        hiredFreelancer: proposal.freelancer,
        status: 'in-progress'
      });
    }

    res.json(proposal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;