const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  view: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false }
}, { _id: false });

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  permissions: {
    users: { type: permissionSchema, default: () => ({}) },
    clients: { type: permissionSchema, default: () => ({}) },
    events: { type: permissionSchema, default: () => ({}) },
    inquiries: { type: permissionSchema, default: () => ({}) },
    attendance: { type: permissionSchema, default: () => ({}) },
    payroll: { type: permissionSchema, default: () => ({}) },
    equipment: { type: permissionSchema, default: () => ({}) },
    pipeline: { type: permissionSchema, default: () => ({}) },
    payments: { type: permissionSchema, default: () => ({}) },
    taskAssignments: {
      type: new mongoose.Schema({
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false }
      }, { _id: false }),
      default: () => ({})
    },
    reports: {
      type: new mongoose.Schema({ view: { type: Boolean, default: false } }, { _id: false }),
      default: () => ({})
    },
    settings: {
      type: new mongoose.Schema({
        view: { type: Boolean, default: false },
        edit: { type: Boolean, default: false }
      }, { _id: false }),
      default: () => ({})
    },
    chat: {
      type: new mongoose.Schema({
        view: { type: Boolean, default: false },
        create: { type: Boolean, default: false }
      }, { _id: false }),
      default: () => ({})
    }
  },
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});


// Prevent deletion of system roles
roleSchema.pre('deleteOne', { document: true, query: false }, function (next) {
  if (this.isSystem) {
    const error = new Error('Cannot delete system role');
    error.code = 'SYSTEM_ROLE_DELETE';
    return next(error);
  }
  next();
});

roleSchema.pre('findOneAndDelete', async function (next) {
  const role = await this.model.findOne(this.getFilter());
  if (role && role.isSystem) {
    const error = new Error('Cannot delete system role');
    error.code = 'SYSTEM_ROLE_DELETE';
    return next(error);
  }
  next();
});

// Static method to check if a role has a specific permission
roleSchema.methods.hasPermission = function (module, action) {
  if (!this.permissions[module]) return false;
  return this.permissions[module][action] === true;
};

// Static method to get all permissions as a flat object
roleSchema.methods.getPermissionsFlat = function () {
  const flat = {};
  for (const [module, perms] of Object.entries(this.permissions.toObject())) {
    for (const [action, value] of Object.entries(perms)) {
      flat[`${module}.${action}`] = value;
    }
  }
  return flat;
};

// Create indexes

roleSchema.index({ isSystem: 1 });

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
