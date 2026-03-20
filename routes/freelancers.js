const express = require('express');
const User = require('../models/User');
const Review = require('../models/Review');
const Job = require('../models/Job');
const router = express.Router();

// Get all freelancers with filters
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      skills, 
      minRate, 
      maxRate, 
      minRating,
      sort = 'newest' 
    } = req.query;

    let filter = { userType: 'freelancer' };
    
    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Skills filter
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      filter.skills = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    // Hourly rate filter
    if (minRate || maxRate) {
      filter.hourlyRate = {};
      if (minRate) filter.hourlyRate.$gte = parseInt(minRate);
      if (maxRate) filter.hourlyRate.$lte = parseInt(maxRate);
    }

    // Rating filter
    if (minRating) {
      filter.averageRating = { $gte: parseFloat(minRating) };
    }

    // Sort options
    let sortOptions = {};
    switch (sort) {
      case 'rating':
        sortOptions = { averageRating: -1 };
        break;
      case 'rate_low':
        sortOptions = { hourlyRate: 1 };
        break;
      case 'rate_high':
        sortOptions = { hourlyRate: -1 };
        break;
      case 'reviews':
        sortOptions = { totalReviews: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const freelancers = await User.find(filter)
      .select('name email skills bio hourlyRate averageRating totalReviews profilePicture experience portfolio createdAt')
      .sort(sortOptions);

    // Get review details for each freelancer
    const freelancersWithDetails = await Promise.all(
      freelancers.map(async (freelancer) => {
        const reviews = await Review.find({ reviewee: freelancer._id })
          .populate('reviewer', 'name profilePicture')
          .limit(3)
          .sort({ createdAt: -1 });

        const completedJobs = await Job.countDocuments({
          hiredFreelancer: freelancer._id,
          status: 'completed'
        });

        return {
          ...freelancer.toObject(),
          recentReviews: reviews,
          completedJobs
        };
      })
    );

    res.json(freelancersWithDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single freelancer profile
router.get('/:id', async (req, res) => {
  try {
    const freelancer = await User.findById(req.params.id)
      .select('-password');

    if (!freelancer || freelancer.userType !== 'freelancer') {
      return res.status(404).json({ message: 'Freelancer not found' });
    }

    // Get reviews
    const reviews = await Review.find({ reviewee: freelancer._id })
      .populate('reviewer', 'name profilePicture')
      .populate('job', 'title')
      .sort({ createdAt: -1 });

    // Get completed jobs count
    const completedJobs = await Job.countDocuments({
      hiredFreelancer: freelancer._id,
      status: 'completed'
    });

    // Get portfolio projects (you might want to create a separate model for this)
    const portfolioProjects = await Job.find({
      hiredFreelancer: freelancer._id,
      status: 'completed'
    })
    .select('title description skillsRequired budget createdAt')
    .limit(6)
    .sort({ createdAt: -1 });

    res.json({
      ...freelancer.toObject(),
      reviews,
      completedJobs,
      portfolioProjects
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get popular skills (for filter suggestions)
router.get('/skills/popular', async (req, res) => {
  try {
    const popularSkills = await User.aggregate([
      { $match: { userType: 'freelancer', skills: { $exists: true, $ne: [] } } },
      { $unwind: '$skills' },
      { $group: { _id: '$skills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json(popularSkills.map(skill => skill._id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;