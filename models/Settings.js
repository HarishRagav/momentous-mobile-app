const mongoose = require('mongoose');

/**
 * Settings Model
 * Key-value configuration storage for studio settings
 * Requirements: 16.4, 16.5, 16.6, 16.7, 16.8
 */
const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Setting key is required'],
    unique: true,
    trim: true,
    enum: {
      values: [
        'studio_profile',
        'event_types',
        'equipment_types',
        'deliverable_types',
        'payment_methods',
        'leave_types',
        'work_start_time',
        'work_end_time',
        'standard_work_hours',
        'late_threshold_minutes',
        'half_day_hours',
        'overtime_multiplier',
        'follow_up_reminder_days',
        'deliverable_overdue_days',
        'pipeline_stuck_days',
        'overtime_hourly_rate',
        'absent_deduction_per_day',
        'casual_leave_threshold',
        'sick_leave_threshold',
        'crm_services',
        'crm_pre_production',
        'crm_milestones',
        'crm_highlights',
        'crm_simple_options'
      ],
      message: '{VALUE} is not a valid setting key'
    }
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Setting value is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

/**
 * Static method to get a setting by key
 * @param {string} key - The setting key
 * @returns {Promise<any>} The setting value or null
 */
settingsSchema.statics.getValue = async function (key) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : null;
};

/**
 * Static method to set a setting value
 * @param {string} key - The setting key
 * @param {any} value - The setting value
 * @param {ObjectId} userId - The user making the change
 * @returns {Promise<Settings>} The updated setting
 */
settingsSchema.statics.setValue = async function (key, value, userId) {
  return this.findOneAndUpdate(
    { key },
    { value, updatedBy: userId },
    { upsert: true, new: true, runValidators: true }
  );
};


/**
 * Static method to get multiple settings by keys
 * @param {string[]} keys - Array of setting keys
 * @returns {Promise<Object>} Object with key-value pairs
 */
settingsSchema.statics.getMultiple = async function (keys) {
  const settings = await this.find({ key: { $in: keys } });
  const result = {};
  settings.forEach(setting => {
    result[setting.key] = setting.value;
  });
  return result;
};

/**
 * Static method to get all settings
 * @returns {Promise<Object>} Object with all key-value pairs
 */
settingsSchema.statics.getAll = async function () {
  const settings = await this.find({});
  const result = {};
  settings.forEach(setting => {
    result[setting.key] = setting.value;
  });
  return result;
};

/**
 * Static method to add an item to an array setting
 * @param {string} key - The setting key
 * @param {any} item - The item to add
 * @param {ObjectId} userId - The user making the change
 * @returns {Promise<Settings>} The updated setting
 */
settingsSchema.statics.addToArray = async function (key, item, userId) {
  const setting = await this.findOne({ key });
  if (!setting) {
    return this.create({ key, value: [item], updatedBy: userId });
  }

  if (!Array.isArray(setting.value)) {
    throw new Error(`Setting ${key} is not an array`);
  }

  // Check for duplicates (case-insensitive for strings, label check for objects)
  const exists = setting.value.some(v => {
    if (typeof v === 'string' && typeof item === 'string') {
      return v.toLowerCase() === item.toLowerCase();
    }
    if (v && item && typeof v === 'object' && typeof item === 'object' && v.label && item.label) {
      return v.label.toLowerCase() === item.label.toLowerCase();
    }
    return v === item;
  });

  if (exists) {
    throw new Error(`Item already exists in ${key}`);
  }

  setting.value.push(item);
  setting.markModified('value'); // Ensure mixed type changes are saved
  setting.updatedBy = userId;
  return setting.save();
};

/**
 * Static method to remove an item from an array setting
 * @param {string} key - The setting key
 * @param {any} item - The item to remove
 * @param {ObjectId} userId - The user making the change
 * @returns {Promise<Settings>} The updated setting
 */
settingsSchema.statics.removeFromArray = async function (key, item, userId) {
  const setting = await this.findOne({ key });
  if (!setting) {
    throw new Error(`Setting ${key} not found`);
  }

  if (!Array.isArray(setting.value)) {
    throw new Error(`Setting ${key} is not an array`);
  }

  const index = setting.value.findIndex(v => {
    // String content comparison
    if (typeof v === 'string' && typeof item === 'string') {
      return v.toLowerCase() === item.toLowerCase();
    }
    // Object content comparison (by label)
    if (v && typeof v === 'object' && v.label && typeof item === 'string') {
      return v.label.toLowerCase() === item.toLowerCase();
    }
    // Direct comparison
    return v === item;
  });

  if (index === -1) {
    throw new Error(`Item not found in ${key}`);
  }

  setting.value.splice(index, 1);
  setting.markModified('value');
  setting.updatedBy = userId;
  return setting.save();
};

/**
 * Get default settings values
 * @returns {Object} Default settings
 */
settingsSchema.statics.getDefaults = function () {
  return {
    studio_profile: {
      name: '',
      logo: '',
      address: '',
      phone: '',
      email: '',
      gst: '',
      currency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      accentColor: '#e94560'
    },
    event_types: ['Wedding', 'Pre-wedding', 'Corporate', 'Baby Shoot', 'Product', 'Birthday', 'Engagement'],
    equipment_types: ['Camera', 'Lens', 'Lighting', 'Drone', 'Audio', 'Tripod', 'Gimbal'],
    deliverable_types: ['Album', 'Video', 'Raw Files', 'Frames', 'Highlights', 'Teaser'],
    payment_methods: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'],
    leave_types: ['Sick', 'Casual', 'Earned', 'Unpaid'],
    // CRM Options with colors and icons
    crm_services: [
      { label: 'Photography', color: '#3b82f6', icon: 'fas fa-camera' },
      { label: 'Videography', color: '#8b5cf6', icon: 'fas fa-video' },
      { label: 'CP & CV', color: '#ec4899', icon: 'fas fa-film' },
      { label: 'Drone', color: '#06b6d4', icon: 'fas fa-plane' },
      { label: 'Pre-wedding', color: '#f59e0b', icon: 'fas fa-heart' },
      { label: 'Album', color: '#10b981', icon: 'fas fa-book-open' },
      { label: 'Frames', color: '#6366f1', icon: 'fas fa-crop' }
    ],
    crm_pre_production: [
      { label: 'Schedule shared', color: '#10b981', icon: 'fas fa-calendar-check' },
      { label: 'Group created', color: '#3b82f6', icon: 'fas fa-users' },
      { label: 'Shoot done', color: '#8b5cf6', icon: 'fas fa-check-circle' }
    ],
    crm_milestones: [
      { label: '7 & 8/06/2026', color: '#f59e0b', icon: 'fas fa-flag' },
      { label: '14 & 15/06/2026', color: '#06b6d4', icon: 'fas fa-flag' }
    ],
    crm_highlights: [
      { label: 'Retouched', color: '#10b981', icon: 'fas fa-magic' },
      { label: 'Teaser', color: '#3b82f6', icon: 'fas fa-film' },
      { label: 'Magazine', color: '#8b5cf6', icon: 'fas fa-book' },
      { label: 'Candid Video', color: '#ec4899', icon: 'fas fa-video' },
      { label: 'Raw Files', color: '#f59e0b', icon: 'fas fa-folder-open' },
      { label: 'Additional Video', color: '#06b6d4', icon: 'fas fa-video' },
      { label: 'Album', color: '#10b981', icon: 'fas fa-images' },
      { label: 'Pre/Post Wed', color: '#f59e0b', icon: 'fas fa-camera-retro' },
      { label: 'Feedback Call', color: '#3b82f6', icon: 'fas fa-headset' },
      { label: 'Google Review', color: '#ea4335', icon: 'fab fa-google' }
    ],
    // Simple Yes/No options with colors
    crm_simple_options: [
      { label: 'Yes', color: '#10b981', icon: 'fas fa-check' },
      { label: 'No', color: '#ef4444', icon: 'fas fa-times' },
      { label: 'Pending', color: '#f59e0b', icon: 'fas fa-clock' },
      { label: 'Done', color: '#3b82f6', icon: 'fas fa-check-double' }
    ],
    work_start_time: '09:00',
    work_end_time: '18:00',
    standard_work_hours: 8,
    late_threshold_minutes: 15,
    half_day_hours: 4,
    overtime_multiplier: 1.5,
    overtime_hourly_rate: 0, // 0 means calculate from base salary
    absent_deduction_per_day: 0, // 0 means calculate from base salary
    casual_leave_threshold: 2, // Number of casual leaves allowed per month without deduction
    sick_leave_threshold: 2, // Number of sick leaves allowed per month without deduction
    follow_up_reminder_days: 3,
    deliverable_overdue_days: 30,
    pipeline_stuck_days: 7
  };
};

/**
 * Initialize default settings if they don't exist
 * @param {ObjectId} userId - The user creating defaults
 * @returns {Promise<void>}
 */
settingsSchema.statics.initializeDefaults = async function (userId) {
  const defaults = this.getDefaults();
  const operations = [];

  for (const [key, value] of Object.entries(defaults)) {
    operations.push({
      updateOne: {
        filter: { key },
        update: { $setOnInsert: { key, value, updatedBy: userId } },
        upsert: true
      }
    });
  }

  if (operations.length > 0) {
    await this.bulkWrite(operations);
  }
};

// Create indexes

settingsSchema.index({ updatedAt: -1 });

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
