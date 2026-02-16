const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const moment = require('moment');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');

// Fix DNS resolution issues
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

// Import models from parent directory
const User = require('./models/User');
const Client = require('./models/Client');
const Attendance = require('./models/Attendance');
const Payroll = require('./models/Payroll');
const TaskAssignment = require('./models/TaskAssignment');
const Role = require('./models/Role');
const Settings = require('./models/Settings');
const ClientEvent = require('./models/ClientEvent');

const app = express();
const PORT = process.env.PORT || 3001;

// Database Connection with Async Start
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            bufferTimeoutMS: 30000,
        });
        console.log('Mobile App Connected to MongoDB');

        app.listen(PORT, () => {
            console.log(`Mobile Owner App running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
};

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(cookieWrapper);
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'mobile_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// View Engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/layout');

// Global Locals
app.use((req, res, next) => {
    res.locals.moment = moment;
    res.locals.path = req.path;
    res.locals.user = req.session.user || null;
    next();
});

// Helper Middleware
function cookieWrapper(req, res, next) {
    if (req.headers.cookie) {
        req.cookies = require('cookie').parse(req.headers.cookie);
    } else {
        req.cookies = {};
    }
    next();
}

// Auth Middleware (Bypass)
const ensureAuthenticated = (req, res, next) => {
    // Hardcode a dummy user session to avoid DB lookups for auth
    // ALWAYS overwrite for now to fix stale invalid IDs in session store
    req.session.user = {
        _id: '507f1f77bcf86cd799439011', // Valid ObjectId
        name: 'Admin User',
        email: 'admin@studio.com',
        role: { name: 'Owner', _id: '507f1f77bcf86cd799439011' }, // Dummy role
        profilePhoto: 'https://ui-avatars.com/api/?name=Admin+User',
        lastActive: new Date()
    };

    res.locals.user = req.session.user;
    return next();
};

// --- ROUTES ---

// Login (Simplified)
app.get('/login', (req, res) => {
    res.render('login', { layout: false });
});

app.post('/login', async (req, res) => {
    // Bypass actual auth logic
    req.session.user = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Admin User',
        email: 'admin@studio.com',
        role: { name: 'Owner' },
        profilePhoto: 'https://ui-avatars.com/api/?name=Admin+User',
        lastActive: new Date()
    };
    res.redirect('/');
});

// Dashboard
app.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch Data Parallelly
        const [activeTasks, eventsToday, attendanceToday, pendingClients] = await Promise.all([
            TaskAssignment.find({
                assignedTo: req.session.user._id,
                status: { $ne: 'Completed' }
            }).limit(5).populate('assignedTo', 'name profilePhoto'),

            // Use ClientEvent for more accurate daily events list
            ClientEvent.find({
                eventDate: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
                status: { $ne: 'Cancelled' }
            }).limit(5),

            Attendance.find({
                date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
                status: 'Present'
            }).populate('user', 'name profilePhoto'),

            Client.find({
                $expr: { $gt: ["$totalPending", 0] }
            }).sort({ totalPending: -1 }).limit(5)
        ]);

        const clientCount = await Client.countDocuments();
        const presentCount = attendanceToday.length;

        // Simplify events for view
        const eventsView = eventsToday.map(e => ({
            _id: e.client, // Link to client
            name: e.eventName || 'Event',
            event: e.eventType,
            location: e.location
        }));

        // Fetch user lists for sections
        const allUsers = await User.find({ isActive: true }).select('name profilePhoto role');
        const presentIds = attendanceToday.map(a => a.user._id.toString());

        const presentStaff = attendanceToday.map(a => ({
            name: a.user.name,
            profilePhoto: a.user.profilePhoto,
            clockIn: a.clockIn
        }));

        const absentStaff = allUsers.filter(u => !presentIds.includes(u._id.toString())).map(u => ({
            name: u.name,
            profilePhoto: u.profilePhoto
        }));

        res.render('dashboard', {
            activeTasks,
            eventsToday: eventsView,
            presentCount,
            clientCount,
            pendingClients,
            presentStaff,
            absentStaff
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Clients List
app.get('/clients', ensureAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const month = req.query.month || '';

        const query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (status === 'Pending') {
            query.totalPending = { $gt: 0 };
        } else if (status === 'Upcoming') {
            query.eventDate = { $gte: new Date() };
        } else if (status === 'Completed') {
            // Logic for completed could be based on date or custom field, generally date < now
            query.eventDate = { $lt: new Date() };
        }

        if (month) {
            const currentYear = new Date().getFullYear();
            const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
            const startMonth = new Date(currentYear, monthIndex, 1);
            const endMonth = new Date(currentYear, monthIndex + 1, 0);

            // Allow year override if needed, but simple month filter implies current/coming year usually
            query.eventDate = { $gte: startMonth, $lte: endMonth };
        }

        // Default sort: Upcoming events first
        const clients = await Client.find(query)
            .sort({ eventDate: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('clients/index', { clients, search, page, status, month });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Client Details
app.get('/clients/:id', ensureAuthenticated, async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) return res.status(404).send('Client not found');

        // Fetch Tasks linked to client (by description convention or ID)
        const tasks = await TaskAssignment.find({
            description: { $regex: client._id.toString(), $options: 'i' }
        }).populate('assignedTo');

        // Fetch Users for assignment
        const users = await User.find({ isActive: true }).select('name role').populate('role', 'name');

        // Fetch ClientEvent records for this client FIRST
        const clientEvents = await ClientEvent.find({ client: client._id })
            .populate('assignedEmployees.assigneeId', 'name email')
            .sort({ eventDate: 1 });

        // Parse services and merge with existing assignments
        const serviceStrings = client.services ? client.services.split(',').map(s => s.trim()).filter(s => s) : [];
        const existingAssignments = client.customFields && client.customFields.serviceAssignments ? client.customFields.serviceAssignments : [];

        // Build a combined list of all relevant services (booked + manually assigned)
        const allServicesMap = {};

        // 1. Add booked services (defaulting to unassigned)
        serviceStrings.forEach(s => {
            let type = 'Shoot';
            const lower = s.toLowerCase();
            if (lower.includes('edit') || lower.includes('album') || lower.includes('design') || lower.includes('reels') || lower.includes('teaser')) {
                type = 'Edit';
            }
            allServicesMap[s] = { name: s, type, assignment: null };
        });

        // 2. Overlay existing assignments
        existingAssignments.forEach(assign => {
            if (allServicesMap[assign.service]) {
                allServicesMap[assign.service].assignment = assign;
            } else {
                allServicesMap[assign.service] = { name: assign.service, type: assign.type, assignment: assign };
            }
        });

        const serviceList = Object.values(allServicesMap);
        const shootServices = serviceList.filter(s => s.type === 'Shoot');
        const editServices = serviceList.filter(s => s.type === 'Edit');

        // Fetch Related Clients
        let relatedQueryConditions = [];
        if (client.phone) relatedQueryConditions.push({ phone: client.phone });
        if (client.email) relatedQueryConditions.push({ email: client.email });

        let relatedClients = [];
        if (relatedQueryConditions.length > 0) {
            relatedClients = await Client.find({
                _id: { $ne: client._id },
                $or: relatedQueryConditions
            }).select('name event eventDate location');
        }

        // Fetch available services
        let availableServices = [];
        const crmServicesSetting = await Settings.getValue('crm_services');
        if (crmServicesSetting && Array.isArray(crmServicesSetting)) {
            availableServices = crmServicesSetting.map(s => s.label);
        } else {
            availableServices = [...serviceStrings, 'Photography', 'Videography', 'Drone', 'Candid', 'Album', 'Traditional Video', 'Traditional Photo'];
        }

        res.render('clients/show', {
            client,
            tasks,
            users,
            shootServices,
            editServices,
            relatedClients,
            availableServices,
            clientEvents,
            error: req.query.error
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Update Client
app.post('/clients/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { event, location } = req.body;
        await Client.findByIdAndUpdate(req.params.id, { event, location });
        res.redirect('/clients/' + req.params.id);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Assign Team Member & Service
app.post('/clients/:id/assign', ensureAuthenticated, async (req, res) => {
    try {
        const { assignedTo, type, serviceName, eventId } = req.body;
        const client = await Client.findById(req.params.id);
        const user = await User.findById(assignedTo);

        if (!client || !user) return res.status(404).send('Not Found');

        const assignmentData = {
            service: serviceName,
            type: type,
            assignee: user.name,
            assigneeId: user._id,
            assignedAt: new Date()
        };

        // IF eventId is provided, assign to that SPECIFIC event
        if (eventId) {
            const targetEvent = await ClientEvent.findById(eventId);
            if (targetEvent) {
                if (!targetEvent.assignedEmployees) targetEvent.assignedEmployees = [];

                // If service string on event doesn't contain this service, append it? 
                // Useful if assigning something NEW.
                const currentServices = targetEvent.services ? targetEvent.services.split(',').map(s => s.trim()) : [];
                if (!currentServices.includes(serviceName)) {
                    currentServices.push(serviceName);
                    targetEvent.services = currentServices.join(', ');
                }

                targetEvent.assignedEmployees.push(assignmentData);

                // Update legacy strings
                const shootNames = targetEvent.assignedEmployees.filter(a => a.type === 'Shoot').map(a => a.assignee);
                const editNames = targetEvent.assignedEmployees.filter(a => a.type === 'Edit').map(a => a.assignee);
                targetEvent.shootTeam = [...new Set(shootNames)].join(', ');
                targetEvent.editTeam = [...new Set(editNames)].join(', ');

                await targetEvent.save();
            }
        } else {
            // FALLBACK: Default behavior (Client level + First Event)

            // 1. Update Client Custom Fields
            client.customFields = client.customFields || {};
            let assignments = client.customFields.serviceAssignments || [];
            if (!Array.isArray(assignments)) assignments = [];
            assignments.push(assignmentData);
            client.customFields.serviceAssignments = assignments;

            // Sync Legacy Strings
            const shootNames = [...new Set(assignments.filter(a => a.type === 'Shoot').map(a => a.assignee))];
            const editNames = [...new Set(assignments.filter(a => a.type === 'Edit').map(a => a.assignee))];
            client.customFields.shootTeam = shootNames.join(', ');
            client.customFields.editTeam = editNames.join(', ');

            client.markModified('customFields');
            await client.save({ validateBeforeSave: false });

            // 2. Sync to First ClientEvent
            const clientEvents = await ClientEvent.find({ client: client._id });
            if (clientEvents.length > 0) {
                const targetEvent = clientEvents[0];
                if (!targetEvent.assignedEmployees) targetEvent.assignedEmployees = [];
                targetEvent.assignedEmployees.push(assignmentData);
                const shootNamesEvent = targetEvent.assignedEmployees.filter(a => a.type === 'Shoot').map(a => a.assignee);
                const editNamesEvent = targetEvent.assignedEmployees.filter(a => a.type === 'Edit').map(a => a.assignee);
                targetEvent.shootTeam = [...new Set(shootNamesEvent)].join(', ');
                targetEvent.editTeam = [...new Set(editNamesEvent)].join(', ');
                await targetEvent.save();
            }
        }

        // 3. Create Task
        await TaskAssignment.create({
            title: `${type} - ${serviceName} for ${client.name}`,
            description: `Client ID: ${client._id}\nEvent: ${eventId ? 'Specific Event' : client.event}\nLocation: ${client.location}`,
            assignedTo: user._id,
            assignedBy: req.session.user._id,
            dueDate: client.eventDate,
            priority: 'High',
            isVisibleToAssignee: true
        });

        res.redirect('/clients/' + req.params.id);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Bulk Sync Event Assignments
app.post('/clients/:id/events/:eventId/sync-assignments', ensureAuthenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { type, assignments } = req.body; // assignments: stringified JSON of [{ serviceName, assignedTo }]

        const targetEvent = await ClientEvent.findById(eventId);
        if (!targetEvent) return res.status(404).send('Event not found');

        if (!targetEvent.assignedEmployees) targetEvent.assignedEmployees = [];

        let assignmentsList = [];
        try {
            assignmentsList = JSON.parse(assignments);
        } catch (e) {
            console.error("JSON Parse Error", e);
            assignmentsList = [];
        }

        // Filter out everything NOT of this type (keep them safe)
        let otherTypeAssignments = targetEvent.assignedEmployees.filter(a => a.type !== type);

        const newAssignments = [];
        const processedServices = [];

        for (const item of assignmentsList) {
            const { serviceName, assignedTo } = item;
            if (!serviceName) continue;
            processedServices.push(serviceName);

            if (assignedTo) {
                const user = await User.findById(assignedTo);
                if (user) {
                    newAssignments.push({
                        service: serviceName,
                        type: type,
                        assignee: user.name,
                        assigneeId: user._id,
                        assignedAt: new Date()
                    });
                }
            }
        }

        // Merge
        targetEvent.assignedEmployees = [...otherTypeAssignments, ...newAssignments];

        // Update Services String
        const currentServices = targetEvent.services ? targetEvent.services.split(',').map(s => s.trim()) : [];
        const combinedServices = [...new Set([...currentServices, ...processedServices])];
        targetEvent.services = combinedServices.join(', ');

        // Update Legacy Strings
        const shootNames = targetEvent.assignedEmployees.filter(a => a.type === 'Shoot').map(a => a.assignee);
        const editNames = targetEvent.assignedEmployees.filter(a => a.type === 'Edit').map(a => a.assignee);
        targetEvent.shootTeam = [...new Set(shootNames)].join(', ');
        targetEvent.editTeam = [...new Set(editNames)].join(', ');

        await targetEvent.save();

        res.redirect('/clients/' + req.params.id);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});



// Update Assignments (Bulk)
app.post('/clients/:id/update-assignments', ensureAuthenticated, async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) return res.status(404).send('Not Found');

        const { assignments } = req.body;

        if (!assignments || !Array.isArray(assignments)) {
            return res.redirect('/clients/' + req.params.id);
        }

        client.customFields = client.customFields || {};
        let currentAssignments = client.customFields.serviceAssignments || [];
        if (!Array.isArray(currentAssignments)) currentAssignments = [];

        let conflicts = [];
        for (const update of assignments) {
            const { serviceName, type, assignedTo } = update;
            if (!assignedTo) continue;

            const user = await User.findById(assignedTo);
            if (!user) continue;

            // Check for Schedule Conflicts
            if (client.eventDate) {
                const startOfDay = new Date(client.eventDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(client.eventDate);
                endOfDay.setHours(23, 59, 59, 999);

                const conflict = await TaskAssignment.findOne({
                    assignedTo: user._id,
                    dueDate: { $gte: startOfDay, $lte: endOfDay },
                    description: { $not: { $regex: client._id.toString() } }
                });

                if (conflict) {
                    conflicts.push(`${user.name} is booked`);
                    continue;
                }
            }

            // Update Logic (simplified for brevity, matching existing)
            currentAssignments = currentAssignments.filter(a => a.service !== serviceName);
            currentAssignments.push({
                service: serviceName,
                type: type,
                assignee: user.name,
                assigneeId: user._id,
                assignedAt: new Date()
            });

            // Update Task Logic (simplified)
            const taskTitle = `${type} - ${serviceName} for ${client.name}`;
            const existingTask = await TaskAssignment.findOne({
                title: taskTitle,
                description: { $regex: client._id.toString(), $options: 'i' }
            });
            if (existingTask) {
                existingTask.assignedTo = user._id;
                await existingTask.save();
            } else {
                await TaskAssignment.create({
                    title: taskTitle,
                    description: `Client ID: ${client._id}\nEvent: ${client.event}\nLocation: ${client.location}`,
                    assignedTo: user._id,
                    assignedBy: req.session.user._id,
                    dueDate: client.eventDate,
                    priority: 'High',
                    isVisibleToAssignee: true
                });
            }
        }

        client.customFields.serviceAssignments = currentAssignments;

        // Sync Legacy Strings
        const shootNames = [...new Set(currentAssignments.filter(a => a.type === 'Shoot').map(a => a.assignee))];
        const editNames = [...new Set(currentAssignments.filter(a => a.type === 'Edit').map(a => a.assignee))];
        client.customFields.shootTeam = shootNames.join(', ');
        client.customFields.editTeam = editNames.join(', ');

        client.markModified('customFields');
        await client.save({ validateBeforeSave: false });

        if (conflicts.length > 0) {
            return res.redirect('/clients/' + req.params.id + '?error=' + encodeURIComponent(conflicts.join(', ')));
        }

        res.redirect('/clients/' + req.params.id);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// --- ATTENDANCE ROUTES ---
app.post('/attendance/mark', ensureAuthenticated, async (req, res) => {
    try {
        const { status, latitude, longitude } = req.body;
        const userId = req.session.user._id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let attendance = await Attendance.findOne({
            user: userId,
            date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        });

        if (attendance) {
            attendance.status = status;
            attendance.clockIn = new Date(); // Use clockIn standard
            if (latitude) attendance.location = { latitude, longitude };
            await attendance.save();
        } else {
            await Attendance.create({
                user: userId,
                date: new Date(),
                status: status || 'Present',
                clockIn: new Date(),
                location: { latitude, longitude }
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

app.get('/attendance/check', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOne({
            user: userId,
            date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        });

        res.json({ marked: !!attendance, status: attendance ? attendance.status : null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// --- PAYROLL ROUTES ---
app.get('/payroll', ensureAuthenticated, async (req, res) => {
    try {
        const today = new Date();
        const month = today.getMonth() + 1; // 1-12
        const year = today.getFullYear();
        const monthName = moment(today).format('MMMM');

        // Fetch payroll for current month
        let payrolls = await Payroll.find({ month, year }).populate('user', 'name profilePhoto');

        // If no payrolls, we might want to preview potential payroll based on users
        // For now, just show what we have.

        // Calculate Summary
        const totalPayout = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
        const pendingCount = payrolls.filter(p => p.status !== 'Paid').length;

        res.render('payroll/index', {
            payrolls,
            monthName,
            year,
            totalPayout,
            pendingCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Redirect /attendance to dashboard (since list is there)
app.get('/attendance', ensureAuthenticated, (req, res) => {
    res.redirect('/');
});

// Start Server
startServer();

