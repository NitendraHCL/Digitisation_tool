const User = require('../models/User');

// Create a new user (admin only)
const createUser = async (req, res) => {
  try {
    console.log('[ADMIN CONTROLLER] Creating new user by:', req.user.email);

    const { email, password, name, role } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('[ADMIN CONTROLLER] User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const newUser = new User({
      email,
      password,
      name,
      role: role || 'nurse',
      createdBy: req.user.userId
    });

    await newUser.save();
    console.log('[ADMIN CONTROLLER] User created successfully:', email);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER] Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all users (admin only)
const getUsers = async (req, res) => {
  try {
    console.log('[ADMIN CONTROLLER getUsers] ========== START ==========');
    console.log('[ADMIN CONTROLLER getUsers] Fetching all users for:', req.user.email);

    const users = await User.find()
      .select('-password')
      .populate('createdBy', 'name email')
      .sort('-createdAt');

    console.log('[ADMIN CONTROLLER getUsers] Found', users.length, 'users');

    // Log detailed information for each user
    users.forEach((user, index) => {
      console.log(`[ADMIN CONTROLLER getUsers] User ${index + 1}:`, {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    });

    console.log('[ADMIN CONTROLLER getUsers] ========== END ==========');

    res.json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        users,
        count: users.length
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER getUsers] ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, status } = req.body;

    console.log('[ADMIN CONTROLLER updateUser] ========== START ==========');
    console.log('[ADMIN CONTROLLER updateUser] Updating user:', id);
    console.log('[ADMIN CONTROLLER updateUser] Updated by:', req.user.email);
    console.log('[ADMIN CONTROLLER updateUser] Request body:', { name, role, isActive, status });

    const user = await User.findById(id);
    if (!user) {
      console.log('[ADMIN CONTROLLER updateUser] User not found:', id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('[ADMIN CONTROLLER updateUser] User before update:', {
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      isActive: user.isActive
    });

    // Update fields
    if (name !== undefined) {
      console.log('[ADMIN CONTROLLER updateUser] Updating name from', user.name, 'to', name);
      user.name = name;
    }
    if (role !== undefined) {
      console.log('[ADMIN CONTROLLER updateUser] Updating role from', user.role, 'to', role);
      user.role = role;
    }
    if (status !== undefined) {
      console.log('[ADMIN CONTROLLER updateUser] Updating status from', user.status, 'to', status);
      user.status = status;
    }
    if (isActive !== undefined) {
      console.log('[ADMIN CONTROLLER updateUser] Updating isActive from', user.isActive, 'to', isActive);
      user.isActive = isActive;
    }

    console.log('[ADMIN CONTROLLER updateUser] Saving user...');
    await user.save();

    console.log('[ADMIN CONTROLLER updateUser] User after save:', {
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      isActive: user.isActive
    });

    console.log('[ADMIN CONTROLLER updateUser] User updated successfully:', user.email);
    console.log('[ADMIN CONTROLLER updateUser] ========== END ==========');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER updateUser] ERROR:', error);
    console.error('[ADMIN CONTROLLER updateUser] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user status (admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('[ADMIN CONTROLLER updateUserStatus] ========== START ==========');
    console.log('[ADMIN CONTROLLER updateUserStatus] Updating status for user:', id);
    console.log('[ADMIN CONTROLLER updateUserStatus] Updated by:', req.user.email);
    console.log('[ADMIN CONTROLLER updateUserStatus] New status:', status);

    // Validate status
    if (!status || !['active', 'inactive', 'blocked'].includes(status)) {
      console.log('[ADMIN CONTROLLER updateUserStatus] Invalid status:', status);
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: active, inactive, blocked'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      console.log('[ADMIN CONTROLLER updateUserStatus] User not found:', id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('[ADMIN CONTROLLER updateUserStatus] User before update:', {
      email: user.email,
      status: user.status,
      isActive: user.isActive
    });

    user.status = status;

    console.log('[ADMIN CONTROLLER updateUserStatus] Saving user...');
    await user.save();

    console.log('[ADMIN CONTROLLER updateUserStatus] User after save:', {
      email: user.email,
      status: user.status,
      isActive: user.isActive
    });

    console.log('[ADMIN CONTROLLER updateUserStatus] Status updated successfully');
    console.log('[ADMIN CONTROLLER updateUserStatus] ========== END ==========');

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER updateUserStatus] ERROR:', error);
    console.error('[ADMIN CONTROLLER updateUserStatus] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset user password (admin only)
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    console.log('[ADMIN CONTROLLER] Resetting password for user:', id);

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Set new password - pre-save hook will hash it
    user.password = newPassword;
    await user.save();

    console.log('[ADMIN CONTROLLER] Password reset successful for:', user.email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER] Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete (deactivate) user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[ADMIN CONTROLLER] Deactivating user:', id, 'by:', req.user.email);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow deleting super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate super admin'
      });
    }

    // Don't allow self-deletion
    if (user._id.toString() === req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    user.isActive = false;
    await user.save();

    console.log('[ADMIN CONTROLLER] User deactivated:', user.email);

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER] Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser
};