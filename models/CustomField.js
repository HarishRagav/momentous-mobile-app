const mongoose = require('mongoose');

/**
 * CustomField Model
 * Dynamic fields for extending Clients, Events, Employees, Equipment
 * Requirements: 17.1, 17.2
 */
const customFieldSchema = new mongoose.Schema({
  module: {
    type: String,
    required: [true, 'Module is required'],
    enum: {
      values: ['Clients', 'Events', 'Employees', 'Equipment'],
      message: '{VALUE} is not a valid module'
    }
  },
  fieldName: {
    type: String,
    required: [true, 'Field name is required'],
    trim: true,
    maxlength: [50, 'Field name cannot exceed 50 characters'],
    match: [/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field name must start with a letter and contain only letters, numbers, and underscores']
  },
  fieldLabel: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
    maxlength: [100, 'Field label cannot exceed 100 characters']
  },
  fieldType: {
    type: String,
    required: [true, 'Field type is required'],
    enum: {
      values: ['Text', 'Number', 'Date', 'Dropdown', 'Checkbox', 'File'],
      message: '{VALUE} is not a valid field type'
    }
  },
  options: [{
    type: String,
    trim: true
  }],
  isRequired: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate field names per module
customFieldSchema.index({ module: 1, fieldName: 1 }, { unique: true });
customFieldSchema.index({ module: 1, order: 1 });
customFieldSchema.index({ isActive: 1 });


/**
 * Validate that dropdown fields have options
 */
customFieldSchema.pre('save', function(next) {
  if (this.fieldType === 'Dropdown' && (!this.options || this.options.length === 0)) {
    const error = new Error('Dropdown fields must have at least one option');
    error.code = 'VALIDATION_ERROR';
    return next(error);
  }
  
  // Clear options for non-dropdown fields
  if (this.fieldType !== 'Dropdown') {
    this.options = [];
  }
  
  next();
});

/**
 * Static method to get all custom fields for a module
 * @param {string} module - The module name
 * @param {boolean} activeOnly - Whether to return only active fields
 * @returns {Promise<CustomField[]>} Array of custom fields
 */
customFieldSchema.statics.getByModule = async function(module, activeOnly = true) {
  const query = { module };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ order: 1, createdAt: 1 });
};

/**
 * Static method to get custom fields for multiple modules
 * @param {string[]} modules - Array of module names
 * @param {boolean} activeOnly - Whether to return only active fields
 * @returns {Promise<Object>} Object with module names as keys
 */
customFieldSchema.statics.getByModules = async function(modules, activeOnly = true) {
  const query = { module: { $in: modules } };
  if (activeOnly) {
    query.isActive = true;
  }
  
  const fields = await this.find(query).sort({ module: 1, order: 1, createdAt: 1 });
  
  const result = {};
  modules.forEach(m => result[m] = []);
  fields.forEach(field => {
    result[field.module].push(field);
  });
  
  return result;
};

/**
 * Static method to validate custom field values
 * @param {string} module - The module name
 * @param {Object} values - Object with field names as keys
 * @returns {Promise<Object>} Validation result { valid: boolean, errors: string[] }
 */
customFieldSchema.statics.validateValues = async function(module, values) {
  const fields = await this.getByModule(module, true);
  const errors = [];
  
  for (const field of fields) {
    const value = values[field.fieldName];
    
    // Check required fields
    if (field.isRequired && (value === undefined || value === null || value === '')) {
      errors.push(`${field.fieldLabel} is required`);
      continue;
    }
    
    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    // Type-specific validation
    switch (field.fieldType) {
      case 'Number':
        if (isNaN(Number(value))) {
          errors.push(`${field.fieldLabel} must be a valid number`);
        }
        break;
        
      case 'Date':
        if (isNaN(Date.parse(value))) {
          errors.push(`${field.fieldLabel} must be a valid date`);
        }
        break;
        
      case 'Dropdown':
        if (!field.options.includes(value)) {
          errors.push(`${field.fieldLabel} must be one of: ${field.options.join(', ')}`);
        }
        break;
        
      case 'Checkbox':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`${field.fieldLabel} must be true or false`);
        }
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Static method to sanitize custom field values
 * @param {string} module - The module name
 * @param {Object} values - Object with field names as keys
 * @returns {Promise<Object>} Sanitized values
 */
customFieldSchema.statics.sanitizeValues = async function(module, values) {
  const fields = await this.getByModule(module, true);
  const sanitized = {};
  
  for (const field of fields) {
    const value = values[field.fieldName];
    
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    switch (field.fieldType) {
      case 'Number':
        sanitized[field.fieldName] = Number(value);
        break;
        
      case 'Date':
        sanitized[field.fieldName] = new Date(value);
        break;
        
      case 'Checkbox':
        sanitized[field.fieldName] = value === true || value === 'true';
        break;
        
      case 'Text':
      case 'Dropdown':
      case 'File':
      default:
        sanitized[field.fieldName] = String(value).trim();
        break;
    }
  }
  
  return sanitized;
};

/**
 * Static method to reorder fields within a module
 * @param {string} module - The module name
 * @param {string[]} fieldIds - Array of field IDs in desired order
 * @returns {Promise<void>}
 */
customFieldSchema.statics.reorder = async function(module, fieldIds) {
  const operations = fieldIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, module },
      update: { $set: { order: index } }
    }
  }));
  
  if (operations.length > 0) {
    await this.bulkWrite(operations);
  }
};

/**
 * Instance method to check if field can be deleted
 * (Can be extended to check if field is in use)
 * @returns {boolean}
 */
customFieldSchema.methods.canDelete = function() {
  // For now, all fields can be deleted
  // This can be extended to check if the field has data in any records
  return true;
};

const CustomField = mongoose.model('CustomField', customFieldSchema);

module.exports = CustomField;
