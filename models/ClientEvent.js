const mongoose = require('mongoose');

const clientEventSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: [true, 'Client reference is required']
    },
    eventType: {
        type: String,
        required: [true, 'Event type is required'],
        trim: true
    },
    eventName: {
        type: String,
        trim: true
    },
    eventDate: {
        type: Date,
        required: [true, 'Event date is required']
    },
    location: {
        type: String,
        trim: true
    },
    contactNumber: {
        type: String,
        trim: true
    },
    parentsNumber: {
        type: String,
        trim: true
    },
    addPpNumInGroup: {
        type: String,
        trim: true
    },
    wishes: {
        type: String,
        trim: true
    },
    services: {
        type: String, // Comma separated list
        trim: true
    },
    shootTeam: {
        type: String, // Comma separated list
        trim: true
    },
    editTeam: {
        type: String, // Comma separated list
        trim: true
    },
    // Status Fields
    preProduction: {
        type: String,
        trim: true
    },
    milestone: {
        type: String,
        trim: true
    },
    payment: {
        type: String,
        trim: true
    },
    rawFiles: {
        type: String,
        trim: true
    },
    // Deliverable Statuses
    retouched: {
        type: String,
        trim: true
    },
    teaser: {
        type: String,
        trim: true
    },
    magazine: {
        type: String,
        trim: true
    },
    candidVideo: {
        type: String,
        trim: true
    },
    rawFilesHighlight: {
        type: String,
        trim: true
    },
    additionalVideo: {
        type: String,
        trim: true
    },
    album: {
        type: String,
        trim: true
    },
    prePostWedShoot: {
        type: String,
        trim: true
    },
    // Communication
    feedbackCall: {
        type: String,
        trim: true
    },
    feedbackCall2: {
        type: String,
        trim: true
    },
    prTrcShare: {
        type: String,
        trim: true
    },
    googleReview: {
        type: String,
        trim: true
    },
    addons: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Addon'
    }],
    // Structured employee assignments per service
    assignedEmployees: [{
        service: { type: String, trim: true },       // e.g., "Photography"
        type: { type: String, trim: true },           // "Shoot" or "Edit"
        assignee: { type: String, trim: true },       // Employee name (for display)
        assigneeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        assignedAt: { type: Date, default: Date.now }
    }],
    status: {
        type: String,
        enum: ['Upcoming', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Upcoming'
    },
    notes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Created by user is required']
    }
}, {
    timestamps: true
});

// Indexes for faster queries
clientEventSchema.index({ client: 1 });
clientEventSchema.index({ eventDate: 1 });
clientEventSchema.index({ eventType: 1 });
clientEventSchema.index({ createdBy: 1 });

const ClientEvent = mongoose.model('ClientEvent', clientEventSchema);

module.exports = ClientEvent;
