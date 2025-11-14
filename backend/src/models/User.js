const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'nurse', 'super_admin'],
    default: 'nurse'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    console.log('[USER MODEL] Hashing password for user:', this.email);
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    console.error('[USER MODEL] Error hashing password:', error);
    next(error);
  }
});

// Sync status with isActive for backward compatibility
userSchema.pre('save', function(next) {
  console.log('[USER MODEL PRE-SAVE] User:', this.email);
  console.log('[USER MODEL PRE-SAVE] Current status:', this.status);
  console.log('[USER MODEL PRE-SAVE] Current isActive:', this.isActive);

  // If status is modified, sync isActive
  if (this.isModified('status')) {
    console.log('[USER MODEL PRE-SAVE] Status was modified, syncing isActive');
    this.isActive = this.status === 'active';
    console.log('[USER MODEL PRE-SAVE] Updated isActive to:', this.isActive);
  }
  // If isActive is modified, sync status
  else if (this.isModified('isActive')) {
    console.log('[USER MODEL PRE-SAVE] isActive was modified, syncing status');
    this.status = this.isActive ? 'active' : 'inactive';
    console.log('[USER MODEL PRE-SAVE] Updated status to:', this.status);
  }
  // If neither is set (new user), ensure they're in sync
  else if (!this.status) {
    console.log('[USER MODEL PRE-SAVE] No status set, setting default');
    this.status = this.isActive ? 'active' : 'inactive';
    console.log('[USER MODEL PRE-SAVE] Set status to:', this.status);
  }

  console.log('[USER MODEL PRE-SAVE] Final status:', this.status);
  console.log('[USER MODEL PRE-SAVE] Final isActive:', this.isActive);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('[USER MODEL] Comparing password for user:', this.email);
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('[USER MODEL] Error comparing password:', error);
    return false;
  }
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Debug: Log when model is created
console.log('[USER MODEL] User model loaded');

module.exports = mongoose.model('User', userSchema);