const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  userType: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  // Add to userSchema
averageRating: {
  type: Number,
  default: 0
},
totalReviews: {
  type: Number,
  default: 0
},
  // Freelancer specific fields
  skills: [String],
  bio: String,
  experience: String,
  education: String,
  portfolio: String,
  hourlyRate: Number,
  // Client specific fields
  company: String,
  position: String,
  // Common fields
  phone: String,
  address: String,
  profilePicture: String,
  isProfileComplete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);