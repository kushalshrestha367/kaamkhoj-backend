const express = require('express');
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');
const router = express.Router();

// Create a review
router.post('/', auth, async (req, res) => {
  try {
    const { jobId, rating, comment, type } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Determine reviewee based on review type
    let reviewee;
    if (type === 'client_to_freelancer') {
      if (job.client.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Only client can review freelancer' });
      }
      reviewee = job.hiredFreelancer;
    } else {
      if (job.hiredFreelancer?.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Only hired freelancer can review client' });
      }
      reviewee = job.client;
    }

    if (!reviewee) {
      return res.status(400).json({ message: 'No one to review for this job' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      job: jobId,
      reviewer: req.user.userId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this job' });
    }

    const review = new Review({
      job: jobId,
      reviewer: req.user.userId,
      reviewee: reviewee,
      rating: rating,
      comment: comment,
      type: type
    });

    await review.save();

    // Update user's average rating
    await updateUserRating(reviewee);

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ ADD THIS NEW ENDPOINT HERE - Get featured testimonials for homepage
router.get('/featured', async (req, res) => {
  try {
    const featuredReviews = await Review.find({})
      .populate('reviewer', 'name profilePicture')
      .populate('job', 'title')
      .sort({ createdAt: -1 })
      .limit(3);

    // Format for homepage display
    const testimonials = featuredReviews.map(review => ({
      _id: review._id,
      reviewer: {
        name: review.reviewer.name,
        profilePicture: review.reviewer.profilePicture
      },
      rating: review.rating,
      comment: review.comment,
      type: review.type,
      createdAt: review.createdAt
    }));

    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'name profilePicture')
      .populate('job', 'title')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user rating summary
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId });
    
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };

    res.json({
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      ratingDistribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to update user rating
async function updateUserRating(userId) {
  const reviews = await Review.find({ reviewee: userId });
  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  await User.findByIdAndUpdate(userId, {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length
  });
}

module.exports = router;