const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { readSheet } = require('read-excel-file/node');
const writeXlsxFile = require('write-excel-file/node').default;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_COOKIE = 'salon_session';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const googleAuthRequired = false;
const defaultPermissionCategories = ['Customer Entry', 'Daily Expense', 'Salary', 'Cash At Counter'];
const accessGroupDefinitions = [
    {
        key: 'configuration',
        label: 'Configuration',
        description: 'General Configuration, Shop Details, Expense Types, Rate List, Bulk Entry and Import Validation.',
        pages: ['configuration', 'shop-information', 'expense-types', 'rate-list', 'bulk-entry', 'import-validation'],
        actions: ['add', 'view', 'edit', 'delete']
    },
    {
        key: 'reports',
        label: 'Reports',
        description: 'Reports and Activity Report.',
        pages: ['reports', 'activity-report'],
        actions: ['add', 'view', 'edit', 'delete', 'deactivate', 'export']
    },
    {
        key: 'employee-list',
        label: 'Employee List',
        description: 'Employee List and Add Employee.',
        pages: ['employee-list', 'employee-entry'],
        actions: ['add', 'view', 'edit', 'deactivate']
    }
];
const accessPageDefinitions = [
    { key: 'dashboard', label: 'Dashboard', path: '/employee-dashboard' },
    { key: 'collection-records', label: 'Collection Records', path: '/collection-table', permission: 'Customer Entry' },
    { key: 'collection-entry', label: 'Collection Entry', path: '/collection-entry', permission: 'Customer Entry', action: 'add' },
    { key: 'expense-records', label: 'Expense Records', path: '/expense-table', permission: 'Daily Expense' },
    { key: 'expense-entry', label: 'Expense Entry', path: '/expense-entry', permission: 'Daily Expense', action: 'add' },
    { key: 'salary-records', label: 'Salary Records', path: '/salary-table', permission: 'Salary' },
    { key: 'salary-entry', label: 'Salary Entry', path: '/salary-entry', permission: 'Salary', action: 'add' },
    { key: 'counter-records', label: 'Counter Cash Records', path: '/counter-table', permission: 'Cash At Counter' },
    { key: 'counter-entry', label: 'Counter Cash Entry', path: '/counter-entry', permission: 'Cash At Counter', action: 'add' },
    { key: 'employee-list', label: 'Employee List', path: '/employees', group: 'employee-list' },
    { key: 'employee-entry', label: 'Add Employee', path: '/employee-entry', group: 'employee-list' },
    { key: 'user-access', label: 'User Access', path: '/user-access', adminOnly: true },
    { key: 'reports', label: 'Reports', path: '/reports', group: 'reports' },
    { key: 'activity-report', label: 'Activity Report', path: '/activity-report', group: 'reports' },
    { key: 'configuration', label: 'General Configuration', path: '/config', group: 'configuration' },
    { key: 'expense-types', label: 'Expense Types', path: '/expense-types', group: 'configuration' },
    { key: 'rate-list', label: 'Rate List', path: '/rate-list', group: 'configuration' },
    { key: 'bulk-entry', label: 'Bulk Entry', path: '/bulk-entry', group: 'configuration' },
    { key: 'import-validation', label: 'Import Validation', path: '/import-validation', group: 'configuration' },
    { key: 'shop-information', label: 'Shop Information', path: '/shop-details', group: 'configuration' }
];
const accessActionDefinitions = [
    { key: 'collection', label: 'Collection', permission: 'Customer Entry', actions: ['add', 'view', 'edit', 'delete'], combinedDelete: true },
    { key: 'expense', label: 'Expense', permission: 'Daily Expense', actions: ['add', 'view', 'edit', 'delete'], combinedDelete: true },
    { key: 'salary', label: 'Salary', permission: 'Salary', actions: ['add', 'view', 'edit', 'delete'], combinedDelete: true },
    { key: 'counter', label: 'Cash At Counter', permission: 'Cash At Counter', actions: ['add', 'view', 'edit', 'delete'], combinedDelete: true },
    { key: 'employees', label: 'Employee List', group: 'employee-list', actions: ['add', 'view', 'edit', 'deactivate'] },
    { key: 'configuration', label: 'Configuration', group: 'configuration', actions: ['add', 'view', 'edit', 'delete'] },
    { key: 'reports', label: 'Reports', group: 'reports', actions: ['add', 'view', 'edit', 'delete', 'deactivate', 'export'] }
];
const allAccessActions = ['add', 'view', 'edit', 'delete', 'deactivate', 'export'];
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const bootstrapAdminUserId = String(process.env.ADMIN_USER_ID || '').trim().toLowerCase();
const bootstrapAdminPasswordHash = process.env.ADMIN_PASSWORD
    ? bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)
    : '';
const loginAttempts = new Map();
const passwordResetTokens = new Map();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

let mongoReconnectTimer = null;
let mongoReconnectAttempt = 0;

function scheduleMasterDatabaseReconnect() {
    if (mongoReconnectTimer || !process.env.MASTER_MONGO_URI) return;
    const delay = Math.min(60000, 2000 * (2 ** Math.min(mongoReconnectAttempt, 5)));
    mongoReconnectAttempt += 1;
    console.warn(`Master database reconnect scheduled in ${Math.round(delay / 1000)} seconds.`);
    mongoReconnectTimer = setTimeout(() => {
        mongoReconnectTimer = null;
        connectMasterDatabase();
    }, delay);
    mongoReconnectTimer.unref();
}

async function connectMasterDatabase() {
    if (!process.env.MASTER_MONGO_URI || mongoose.connection.readyState !== 0) return;
    const mongoOptions = {
        dbName: process.env.MONGODB_DB_NAME || 'shop_master_db',
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
    };
    try {
        await mongoose.connect(process.env.MASTER_MONGO_URI, mongoOptions);
        mongoReconnectAttempt = 0;
        console.log(`Master Database Connected Successfully! (${mongoOptions.dbName})`);
    } catch (error) {
        console.error('Master DB Connection Error:', error.name, error.reason?.type || '');
        scheduleMasterDatabaseReconnect();
    }
}

mongoose.connection.on('disconnected', scheduleMasterDatabaseReconnect);
mongoose.connection.on('connected', () => {
    mongoReconnectAttempt = 0;
});

if (!process.env.MASTER_MONGO_URI) {
    console.error('MASTER_MONGO_URI is missing in .env');
} else {
    connectMasterDatabase();
}

const shopSchema = new mongoose.Schema({
    shopName: String,
    shopCode: { type: String, unique: true },
    email: { type: String, unique: true },
    dbUri: String
});
const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);

const shopDetailsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    settings: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });
const ShopDetails = mongoose.models.ShopDetails ||
    mongoose.model('ShopDetails', shopDetailsSchema);

const defaultShopDetails = {
    'Brand Name': 'YOURS SALON',
    'Brand Description': 'Salon Management System',
    'Tagline': 'Look Good, Feel Confident',
    'Logo URL': 'https://jkdrycleaner.github.io/Salon_Dashboard/Logo.jpeg',
    'Favicon URL': 'https://jkdrycleaner.github.io/Salon_Dashboard/Logo.jpeg',
    'Theme Mode': 'Combination',
    'Header Style': 'Premium',
    'Header Color': '#211A16',
    'Accent Color': '#C9A227',
    'Header Text Color': '#FFFFFF',
    'Body Background': '#F7F5F2',
    'Card Background': '#FFFFFF',
    'Show Search': 'Yes',
    'Show Notification Bell': 'Yes',
    'Show User Profile': 'Yes',
    'Show Date & Time': 'Yes',
    'Login Slide 1 Image': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=85',
    'Login Slide 1 Title': 'Look Good',
    'Login Slide 1 Description': 'Feel Good, Look Confident',
    'Login Slide 2 Image': 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1400&q=85',
    'Login Slide 2 Title': 'Your Style',
    'Login Slide 2 Description': 'Your Style, Your Confidence',
    'Login Slide 3 Image': 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1400&q=85',
    'Login Slide 3 Title': 'YOURS SALON',
    'Login Slide 3 Description': 'Your Salon Management System',
    'Login Slide Duration': '4000',
    'Login Logo Width': '64',
    'Login Logo Height': '64',
    'Login Name Font Size': '34',
    'Login Page Theme': 'Combination',
    'Button Style': 'Solid',
    'Button Color': '#C9A227',
    'Button Color 2': '#8A6D1B',
    'Show Google Login': 'Yes',
    'Show Mobile Login': 'Yes',
    'Show Face Login': 'Yes',
    'Show Password Login': 'Yes'
};

const expenseTypeSchema = new mongoose.Schema({
    sr: { type: Number, required: true, unique: true, min: 1 },
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });
const ExpenseType = mongoose.models.ExpenseType ||
    mongoose.model('ExpenseType', expenseTypeSchema);

const employeeFieldSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true, unique: true, trim: true, maxlength: 50 }
}, { timestamps: true });
const EmployeeField = mongoose.models.EmployeeField ||
    mongoose.model('EmployeeField', employeeFieldSchema);

const employeeSchema = new mongoose.Schema({
    sr: { type: Number, min: 0 },
    employeeId: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    emailAddress: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
    mobileNumber: { type: String, required: true, trim: true, maxlength: 20 },
    employeeName: { type: String, required: true, trim: true, maxlength: 150 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    joiningDate: { type: String, trim: true, default: '' },
    dateOfBirth: { type: String, trim: true, default: '' },
    panNumber: { type: String, trim: true, uppercase: true, default: '', maxlength: 10 },
    aadhaarCardNumber: { type: String, trim: true, default: '', maxlength: 12 },
    address: { type: String, trim: true, default: '', maxlength: 500 },
    city: { type: String, trim: true, default: '', maxlength: 100 },
    state: { type: String, trim: true, default: '', maxlength: 100 },
    pinCode: { type: String, trim: true, default: '', maxlength: 6 },
    alternateMobileNumber: { type: String, trim: true, default: '', maxlength: 15 },
    expenseType: { type: String, trim: true, default: '', maxlength: 150 },
    expenseTypeSr: { type: Number, min: 1 },
    expenseTypes: {
        type: [{
            sr: { type: Number, required: true, min: 1 },
            name: { type: String, required: true, trim: true, maxlength: 100 }
        }],
        default: []
    },
    userId: { type: String, trim: true, lowercase: true, default: '', maxlength: 100 },
    role: { type: String, trim: true, default: 'Employee', maxlength: 80 },
    passwordHash: { type: String, select: false },
    mustChangePassword: { type: Boolean, default: false },
    salaryMode: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    salaryPercentage: { type: Number, min: 0, max: 100, default: 50 },
    fixedMonthlySalary: { type: Number, min: 0, default: 0 },
    photoUrl: { type: String, trim: true, default: '', maxlength: 1000000 },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true,
    toJSON: {
        transform(document, result) {
            delete result.passwordHash;
            return result;
        }
    }
});
employeeSchema.index(
    { userId: 1 },
    { unique: true, partialFilterExpression: { userId: { $gt: '' } } }
);
employeeSchema.index(
    { emailAddress: 1 },
    { unique: true, partialFilterExpression: { emailAddress: { $gt: '' } } }
);
const Employee = mongoose.models.Employee ||
    mongoose.model('Employee', employeeSchema);

const collectionSchema = new mongoose.Schema({
    entryNo: { type: Number, required: true },
    entryDate: { type: Date, required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    staff: { type: String, required: true, trim: true },
    serviceType: { type: String, required: true, trim: true },
    items: {
        type: [new mongoose.Schema({
            serviceType: { type: String, required: true, trim: true, maxlength: 150 },
            shortName: { type: String, trim: true, default: '', maxlength: 60 },
            rate: { type: Number, required: true, min: 0 },
            quantity: { type: Number, required: true, min: 1 },
            amount: { type: Number, required: true, min: 0 }
        }, { _id: false })],
        default: undefined
    },
    amount: { type: Number, required: true, min: 0 },
    costCutting: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, required: true, enum: ['Cash', 'Online'] },
    remark: { type: String, trim: true, default: '', maxlength: 1000 },
    createdBy: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    inactiveAction: { type: String, enum: ['', 'Deleted', 'Deactivated'], default: '' },
    inactiveAt: { type: Date, default: null },
    inactiveBy: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now }
});
collectionSchema.index({ entryDate: 1, entryNo: 1 }, { unique: true });
collectionSchema.index({ entryDate: 1, staffId: 1, status: 1, amount: 1 });
const CollectionEntry = mongoose.models.Collection ||
    mongoose.model('Collection', collectionSchema);

const employeeRecordSchema = new mongoose.Schema({
    recordType: { type: String, enum: ['expense', 'salary', 'counter'], required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeName: { type: String, required: true, trim: true },
    entryDate: { type: Date, required: true },
    expenseTypeSr: { type: Number, min: 1 },
    expenseType: { type: String, trim: true, default: '' },
    salaryMonth: { type: String, match: /^\d{4}-\d{2}$/ },
    paymentMode: { type: String, enum: ['Cash', 'Online'], default: 'Cash' },
    amount: { type: Number, required: true, min: 0.01 },
    remark: { type: String, trim: true, default: '', maxlength: 1000 },
    createdBy: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    inactiveAction: { type: String, enum: ['', 'Deleted', 'Deactivated'], default: '' },
    inactiveAt: { type: Date, default: null },
    inactiveBy: { type: String, trim: true, default: '' }
}, { timestamps: true });
employeeRecordSchema.index({ employeeId: 1, entryDate: -1, recordType: 1 });
const EmployeeRecord = mongoose.models.EmployeeRecord ||
    mongoose.model('EmployeeRecord', employeeRecordSchema);

const adminCredentialSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    userId: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    authVersion: { type: Number, default: 0 }
}, { timestamps: true });
const AdminCredential = mongoose.models.AdminCredential ||
    mongoose.model('AdminCredential', adminCredentialSchema);

const permissionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }]
}, { _id: false });
const accessActionSchema = new mongoose.Schema({
    module: { type: String, required: true, trim: true },
    add: { type: Boolean, default: false },
    view: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    deactivate: { type: Boolean, default: false },
    export: { type: Boolean, default: false }
}, { _id: false });
const accessRuleSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    pages: { type: [String], default: [] },
    actions: { type: [accessActionSchema], default: [] }
}, { _id: false });
const employeeDateRuleSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    dates: { type: [String], default: [] }
}, { _id: false });
const appConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    allowPreviousEntry: { type: Boolean, default: false },
    maxPreviousEntryDays: { type: Number, min: 0, max: 3650, default: 0 },
    employeeAllowedDates: { type: [employeeDateRuleSchema], default: [] },
    shortfallAdjustment: { type: String, enum: ['employee', 'costCutting'], default: 'employee' },
    permissions: { type: [permissionSchema], default: [] },
    accessRules: { type: [accessRuleSchema], default: [] }
});
const AppConfig = mongoose.models.AppConfig ||
    mongoose.model('AppConfig', appConfigSchema);

const importRuleSchema = new mongoose.Schema({
    dataset: { type: String, required: true, unique: true, trim: true },
    enabled: { type: Boolean, default: false },
    requiredColumns: { type: [String], default: [] },
    duplicateKeys: { type: [String], default: [] },
    duplicateAction: { type: String, enum: ['reject', 'skip'], default: 'reject' },
    masterChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    valueRules: { type: mongoose.Schema.Types.Mixed, default: {} },
    maxRows: { type: Number, default: 1000, min: 1, max: 1000 }
}, { timestamps: true });
const ImportRule = mongoose.models.ImportRule ||
    mongoose.model('ImportRule', importRuleSchema);

const importDatasetDefinitions = [
    {
        key: 'employees',
        label: 'Employees',
        columns: ['sr', 'employeeid', 'emailaddress', 'mobilenumber', 'employeename', 'designation', 'joiningdate', 'dateofbirth', 'gender', 'bloodgroup', 'address', 'city', 'state', 'pincode', 'alternatemobileno', 'expensetypes', 'userid', 'role', 'salarymode', 'salarypercentage', 'fixedmonthlysalary', 'photourl'],
        defaults: {
            enabled: false,
            requiredColumns: ['employeeid', 'employeename', 'userid'],
            duplicateKeys: ['employeeid'],
            duplicateAction: 'skip',
            masterChecks: { expenseType: true },
            valueRules: { validDate: true, email: true },
            maxRows: 1000
        }
    },
    {
        key: 'customer-entry',
        label: 'Collection Records',
        columns: ['entryno', 'entrydate', 'staff', 'servicetype', 'amount', 'costcutting', 'paymentmode', 'remark', 'email'],
        defaults: {
            enabled: true,
            requiredColumns: ['entryno', 'entrydate', 'staff', 'servicetype', 'amount', 'paymentmode'],
            duplicateKeys: ['entryno', 'entrydate'],
            duplicateAction: 'reject',
            masterChecks: { employee: true },
            valueRules: { positiveAmount: true, validDate: true, paymentMode: true, email: true, remarkLength: true },
            maxRows: 1000
        }
    },
    {
        key: 'expense',
        label: 'Expense Records',
        columns: ['employeeid', 'entrydate', 'expensetypesr', 'amount', 'paymentmode', 'remark'],
        defaults: {
            enabled: false,
            requiredColumns: ['employeeid', 'entrydate', 'expensetypesr', 'amount', 'paymentmode'],
            duplicateKeys: ['employeeid', 'entrydate', 'expensetypesr', 'amount'],
            duplicateAction: 'reject',
            masterChecks: { employee: true, expenseType: true },
            valueRules: { positiveAmount: true, validDate: true, paymentMode: true },
            maxRows: 1000
        }
    },
    {
        key: 'salary',
        label: 'Salary Records',
        columns: ['employeeid', 'entrydate', 'salarymonth', 'amount', 'paymentmode', 'remark'],
        defaults: {
            enabled: false,
            requiredColumns: ['employeeid', 'entrydate', 'salarymonth', 'amount', 'paymentmode'],
            duplicateKeys: ['employeeid', 'salarymonth'],
            duplicateAction: 'reject',
            masterChecks: { employee: true },
            valueRules: { positiveAmount: true, validDate: true, paymentMode: true },
            maxRows: 1000
        }
    },
    {
        key: 'counter',
        label: 'Counter Cash Records',
        columns: ['employeeid', 'entrydate', 'amount', 'remark'],
        defaults: {
            enabled: false,
            requiredColumns: ['employeeid', 'entrydate', 'amount'],
            duplicateKeys: ['employeeid', 'entrydate', 'amount'],
            duplicateAction: 'reject',
            masterChecks: { employee: true },
            valueRules: { positiveAmount: true, validDate: true },
            maxRows: 1000
        }
    }
];
const defaultImportRules = Object.fromEntries(importDatasetDefinitions.map(definition => [
    definition.key,
    definition.defaults
]));

async function importRuleFor(dataset) {
    const defaults = defaultImportRules[dataset];
    if (!defaults) return null;
    const stored = await ImportRule.findOne({ dataset }).lean();
    return { ...defaults, ...(stored || {}), dataset };
}

const employeeDateAccessSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, trim: true },
    grantedAt: { type: Date, default: Date.now },
    grantedBy: { type: String, trim: true, default: '', maxlength: 150 },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });
employeeDateAccessSchema.index({ employeeId: 1, date: 1 }, { unique: true });
employeeDateAccessSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
employeeDateAccessSchema.index({ date: -1, employeeId: 1 });
const EmployeeDateAccess = mongoose.models.EmployeeDateAccess ||
    mongoose.model('EmployeeDateAccess', employeeDateAccessSchema);

const rateListSchema = new mongoose.Schema({
    sr: { type: Number, default: 0, min: 0 },
    serviceType: { type: String, required: true, unique: true, trim: true, maxlength: 150 },
    shortName: { type: String, trim: true, default: '', maxlength: 60 },
    serviceCategory: { type: String, trim: true, default: '', maxlength: 100 },
    rate: { type: Number, required: true, min: 0, max: 100000000 },
    category: { type: String, enum: ['Main', 'Other'], default: 'Main' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: String, trim: true, default: '', maxlength: 150 }
}, { timestamps: true });
const RateList = mongoose.models.RateList || mongoose.model('RateList', rateListSchema);

function rateListSort(left, right) {
    const leftSr = Number.isFinite(Number(left?.sr)) ? Number(left.sr) : Number.MAX_SAFE_INTEGER;
    const rightSr = Number.isFinite(Number(right?.sr)) ? Number(right.sr) : Number.MAX_SAFE_INTEGER;
    return leftSr - rightSr || String(left?.serviceType || '').localeCompare(String(right?.serviceType || ''));
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCollectionItems(value) {
    if (value === undefined || value === null || value === '') return null;
    if (!Array.isArray(value)) {
        const error = new Error('The services list is invalid.');
        error.status = 400;
        throw error;
    }
    const items = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') {
            const error = new Error('The services list contains an invalid item.');
            error.status = 400;
            throw error;
        }
        const serviceType = String(raw.serviceType || raw.name || '').trim().slice(0, 150);
        const shortName = String(raw.shortName || serviceType).trim().slice(0, 60) || serviceType.slice(0, 60);
        const rate = Number(raw.rate);
        const quantity = Number(raw.quantity ?? 1);
        if (!serviceType || !Number.isFinite(rate) || rate < 0 || rate > 100000000 ||
            !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
            const error = new Error('Enter a valid service, rate, and quantity.');
            error.status = 400;
            throw error;
        }
        const amount = Math.round(rate * quantity * 100) / 100;
        if (!Number.isFinite(amount) || amount <= 0) {
            const error = new Error('The service total must be greater than zero.');
            error.status = 400;
            throw error;
        }
        items.push({ serviceType, shortName, rate, quantity, amount });
        if (items.length > 50) {
            const error = new Error('A single entry can contain at most 50 services.');
            error.status = 400;
            throw error;
        }
    }
    if (!items.length) return null;
    const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const summary = items
        .map(item => `${item.shortName || item.serviceType}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
        .join(', ')
        .slice(0, 1000);
    return { items, total, summary };
}

function allocateCollectionAmount(parsedItems, requestedTotal, requestedCutting, config) {
    const gross = Math.round((Number(parsedItems.total) + Number(requestedCutting || 0)) * 100) / 100;
    const total = requestedTotal === undefined || requestedTotal === null || requestedTotal === ''
        ? gross
        : Math.round(Number(requestedTotal) * 100) / 100;
    if (!Number.isFinite(total) || total < 0) {
        const error = new Error('Please enter a valid Total amount.');
        error.status = 400;
        throw error;
    }
    const shortfall = Math.max(0, Math.round((gross - total) * 100) / 100);
    let costCutting = Number(requestedCutting || 0);
    if (config?.shortfallAdjustment === 'costCutting') {
        costCutting = Math.max(0, costCutting - shortfall);
    }
    costCutting = Math.round(Math.min(costCutting, total) * 100) / 100;
    const amount = Math.round(Math.max(0, total - costCutting) * 100) / 100;
    return { amount, costCutting };
}

const auditLogSchema = new mongoose.Schema({
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    actorName: { type: String, required: true, trim: true, maxlength: 150 },
    actorUserId: { type: String, trim: true, lowercase: true, default: '', maxlength: 100 },
    actorRole: { type: String, trim: true, default: '', maxlength: 80 },
    action: { type: String, required: true, trim: true, maxlength: 60 },
    page: { type: String, trim: true, default: '', maxlength: 150 },
    route: { type: String, trim: true, default: '', maxlength: 300 },
    module: { type: String, trim: true, default: '', maxlength: 100 },
    recordType: { type: String, trim: true, default: '', maxlength: 100 },
    recordId: { type: String, trim: true, default: '', maxlength: 100 },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, default: '', maxlength: 100 },
    userAgent: { type: String, trim: true, default: '', maxlength: 500 }
}, { timestamps: true });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
auditLogSchema.index({ createdAt: -1, action: 1, actorId: 1 });
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

class EmployeeInputError extends Error {}

const defaultExpenseTypes = [
    { sr: 2, name: 'Daily Expense List', status: 'Active' },
    { sr: 3, name: 'Salon Supplies', status: 'Active' },
    { sr: 4, name: 'Rent', status: 'Active' },
    { sr: 5, name: 'Electric Bill', status: 'Active' },
    { sr: 6, name: 'EMI', status: 'Inactive' },
    { sr: 7, name: 'Home', status: 'Active' },
    { sr: 8, name: 'Shop', status: 'Active' },
    { sr: 9, name: 'Water', status: 'Active' },
    { sr: 10, name: 'Other', status: 'Active' },
    { sr: 1, name: 'Advance Amount', status: 'Active' }
];

async function ensureDefaultExpenseTypes() {
    if (await ExpenseType.estimatedDocumentCount() > 0) return;
    await ExpenseType.bulkWrite(defaultExpenseTypes.map(expenseType => ({
        updateOne: {
            filter: { sr: expenseType.sr },
            update: { $setOnInsert: expenseType },
            upsert: true
        }
    })));
}

async function syncExpenseTypeReferences(expenseType, previousSr = expenseType.sr) {
    await Promise.all([
        Employee.updateMany(
            { expenseTypeSr: previousSr },
            { $set: { expenseType: expenseType.name } }
        ),
        Employee.updateMany(
            { 'expenseTypes.sr': previousSr },
            { $set: { 'expenseTypes.$[type].name': expenseType.name } },
            { arrayFilters: [{ 'type.sr': previousSr }] }
        )
    ]);
}

async function resolveEmployeeExpenseTypes(input) {
    let selections = Array.isArray(input.expenseTypeSrs) ? input.expenseTypeSrs : [];
    if (!selections.length && Array.isArray(input.expenseTypes)) {
        selections = input.expenseTypes.map(item => item?.sr ?? item?.name ?? item);
    }
    if (!selections.length && input.expenseTypeSr !== undefined && input.expenseTypeSr !== null && input.expenseTypeSr !== '') {
        selections = [input.expenseTypeSr];
    }
    if (!selections.length) {
        const legacyValue = String(input.expenseType ?? '').trim();
        if (legacyValue) selections = legacyValue.split(/[;,]/).map(value => value.trim()).filter(Boolean);
    }
    if (!selections.length) {
        return { expenseType: '', expenseTypeSr: null, expenseTypes: [] };
    }

    const resolved = new Map();
    for (const selection of selections) {
        const value = String(selection ?? '').trim();
        if (!value) continue;
        const serialMatch = /^(\d+)(?:\s*[-:]\s*.*)?$/.exec(value);
        let expenseType;
        if (serialMatch) {
            const sr = Number(serialMatch[1]);
            if (!Number.isSafeInteger(sr) || sr < 1) {
                throw new EmployeeInputError('Select valid Expense Types.');
            }
            expenseType = await ExpenseType.findOne({ sr, status: 'Active' }).lean();
        } else {
            expenseType = await ExpenseType.findOne({
                name: { $regex: `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
                status: 'Active'
            }).lean();
        }
        if (!expenseType) {
            throw new EmployeeInputError(`Select active Expense Types only. "${value}" is unavailable.`);
        }
        resolved.set(expenseType.sr, { sr: expenseType.sr, name: expenseType.name });
    }
    const expenseTypes = [...resolved.values()].sort((left, right) => left.sr - right.sr);
    return {
        expenseType: expenseTypes.map(item => item.name).join(', '),
        expenseTypeSr: expenseTypes[0]?.sr,
        expenseTypes
    };
}

function getEmployeeExpenseTypes(employee, catalog) {
    if (employee.expenseTypes?.length) return employee.expenseTypes;
    const serialsByValue = new Map(catalog.map(item => [String(item.sr), item]));
    const namesByValue = new Map(catalog.map(item => [item.name.toLowerCase(), item]));
    const legacyValues = String(employee.expenseType ?? '').split(/[;,]/).map(value => value.trim()).filter(Boolean);
    if (!legacyValues.length && employee.expenseTypeSr) legacyValues.push(String(employee.expenseTypeSr));
    const matched = new Map();
    for (const value of legacyValues) {
        const srMatch = /^(\d+)(?:\s*[-:]\s*.*)?$/.exec(value);
        const expenseType = srMatch
            ? serialsByValue.get(srMatch[1])
            : namesByValue.get(value.toLowerCase());
        if (expenseType?.status === 'Active') {
            matched.set(expenseType.sr, { sr: expenseType.sr, name: expenseType.name });
        }
    }
    return [...matched.values()].sort((left, right) => left.sr - right.sr);
}

function getTodayDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function parseEntryDate(value) {
    const text = String(value ?? '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const date = match ? new Date(`${text}T00:00:00.000Z`) : null;
    return date && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
        ? text
        : '';
}

function dateAccessExpiry() {
    const end = new Date(`${getTodayDate()}T23:59:59.999+05:30`);
    return Number.isNaN(end.getTime()) ? null : end;
}

async function activeDateAccessForEmployee(employeeId, date) {
    if (!mongoose.isValidObjectId(employeeId)) return null;
    return EmployeeDateAccess.findOne({
        employeeId,
        date,
        expiresAt: { $gt: new Date() }
    }).lean();
}

async function entryDateError(entryDate, today, config, employeeId) {
    if (entryDate > today) return 'Future entry dates are not allowed.';
    if (entryDate === today) return '';
    if (!(config?.allowPreviousEntry)) return 'Previous-date entries are disabled in configuration.';
    const access = await activeDateAccessForEmployee(employeeId, entryDate);
    if (!access) return 'This previous date is not allowed for the selected employee.';
    return '';
}

async function dateAccessRowsWithEmployees(rows) {
    const employeeIds = [...new Set(rows.map(row => String(row.employeeId)))];
    const employees = employeeIds.length
        ? await Employee.find({ _id: { $in: employeeIds } })
            .select('employeeId employeeName status')
            .lean()
        : [];
    const employeesById = new Map(employees.map(employee => [String(employee._id), employee]));
    return rows
        .map(row => {
            const employee = employeesById.get(String(row.employeeId));
            if (!employee) return null;
            return {
                _id: String(row._id),
                employeeId: String(row.employeeId),
                employeeCode: employee.employeeId,
                employeeName: employee.employeeName,
                date: row.date,
                grantedAt: row.grantedAt,
                grantedBy: row.grantedBy || '',
                expiresAt: row.expiresAt
            };
        })
        .filter(Boolean)
        .sort((left, right) =>
            right.date.localeCompare(left.date) ||
            left.employeeName.localeCompare(right.employeeName)
        );
}

async function migrateLegacyDateAccess() {
    const config = await AppConfig.findOne({
        key: 'collection',
        'employeeAllowedDates.0': { $exists: true }
    }).lean();
    if (!config) return;
    const now = new Date();
    const operations = [];
    for (const rule of config.employeeAllowedDates || []) {
        if (!mongoose.isValidObjectId(rule.employeeId)) continue;
        for (const date of rule.dates || []) {
            const expiresAt = dateAccessExpiry();
            if (!expiresAt || expiresAt <= now) continue;
            operations.push({
                updateOne: {
                    filter: { employeeId: rule.employeeId, date },
                    update: {
                        $setOnInsert: {
                            employeeId: rule.employeeId,
                            date,
                            grantedAt: now,
                            grantedBy: 'Migrated configuration',
                            expiresAt
                        }
                    },
                    upsert: true
                }
            });
        }
    }
    if (operations.length) {
        await EmployeeDateAccess.bulkWrite(operations, { ordered: false });
    }
    await AppConfig.updateOne({ _id: config._id }, { $set: { employeeAllowedDates: [] } });
    console.log(`Migrated ${operations.length} previous-date access row(s).`);
}

function isAdmin(employee) {
    const role = String(employee?.role || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    return role === 'admin' || role === 'administrator' || role === 'super admin';
}

function isSuperAdmin(employee) {
    return isAdmin(employee) && !employee?._id;
}

function parseCookies(req) {
    const header = req.get('cookie') || '';
    return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
        const separator = part.indexOf('=');
        if (separator < 0) return [part, ''];
        const key = part.slice(0, separator);
        const value = part.slice(separator + 1);
        try {
            return [key, decodeURIComponent(value)];
        } catch {
            return [key, value];
        }
    }));
}

function requestCredential(req) {
    const cookieCredential = parseCookies(req)[SESSION_COOKIE] || '';
    if (cookieCredential) return cookieCredential;
    const authorization = req.get('authorization') || '';
    if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length);
    return '';
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function auditValue(value, depth = 0) {
    if (value === null || value === undefined) return value ?? null;
    if (depth > 4) return '[truncated]';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value.length > 5000 ? `${value.slice(0, 5000)}…` : value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 100).map(item => auditValue(item, depth + 1));
    if (typeof value.toObject === 'function') return auditValue(value.toObject(), depth + 1);
    if (typeof value === 'object') {
        const result = {};
        for (const [key, item] of Object.entries(value).slice(0, 100)) {
            if (/password|token|secret|credential|mongo(uri|db)|authorization/i.test(key)) continue;
            result[key] = auditValue(item, depth + 1);
        }
        return result;
    }
    return String(value);
}

async function recordAudit(req, details, actor = req.employee) {
    try {
        if (mongoose.connection.readyState !== 1) return;
        const subject = actor || {};
        await AuditLog.create({
            actorId: subject._id || null,
            actorName: String(subject.employeeName || 'Unknown').slice(0, 150),
            actorUserId: String(subject.userId || '').trim().toLowerCase().slice(0, 100),
            actorRole: String(subject.role || '').slice(0, 80),
            action: String(details.action || '').slice(0, 60),
            page: String(details.page || '').slice(0, 150),
            route: String(details.route || req.originalUrl || req.path || '').slice(0, 300),
            module: String(details.module || '').slice(0, 100),
            recordType: String(details.recordType || '').slice(0, 100),
            recordId: String(details.recordId || '').slice(0, 100),
            oldValue: auditValue(details.oldValue),
            newValue: auditValue(details.newValue),
            metadata: auditValue(details.metadata || {}),
            ipAddress: String(req.ip || req.socket.remoteAddress || '').slice(0, 100),
            userAgent: String(req.get('user-agent') || '').slice(0, 500)
        });
    } catch (error) {
        console.error('Audit log write error:', error);
    }
}

function requireSecureAuth(req, res, next) {
    return next();
}

async function verifyEmployee(req, res, next) {
    try {
        const credential = requestCredential(req);
        if (!credential) {
            return res.status(401).json({ error: 'Please sign in with your User ID and password.' });
        }

        let session;
        try {
            session = jwt.verify(credential, sessionSecret);
        } catch {
            session = null;
        }
        if (session?.kind !== 'salon-session') {
            return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
        }
        if (session.sub === 'bootstrap-admin' && session.role === 'Admin' && session.userId) {
            const storedAdmin = await AdminCredential.findOne({ key: 'primary' })
                .select('userId authVersion')
                .lean();
            const isStoredAdmin = storedAdmin?.userId === session.userId &&
                Number(session.authVersion || 0) === Number(storedAdmin.authVersion || 0);
            const isConfiguredAdmin = !storedAdmin && bootstrapAdminPasswordHash &&
                session.userId === bootstrapAdminUserId;
            if (!isStoredAdmin && !isConfiguredAdmin) {
                return res.status(401).json({ error: 'Administrator account is no longer available. Please sign in again.' });
            }
            req.employee = {
                _id: null,
                employeeName: 'Admin',
                userId: session.userId,
                role: 'Admin',
                status: 'Active'
            };
            return next();
        }
        if (!mongoose.isValidObjectId(session.sub)) {
            return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
        }
        const authenticatedEmployee = await Employee.findById(session.sub).lean();
        if (!authenticatedEmployee || authenticatedEmployee.status !== 'Active') {
            return res.status(401).json({ error: 'Your employee account is inactive. Please contact admin.' });
        }
        req.employee = authenticatedEmployee;
        const requestPath = req.path.replace(/\/+$/, '') || '/';
        if (authenticatedEmployee.mustChangePassword &&
            !['/api/session', '/api/change-password', '/api/logout', '/password-change', '/password-change.html'].includes(requestPath)) {
            if (!requestPath.startsWith('/api/')) return res.redirect('/login');
            return res.status(403).json({
                error: 'Change your default password before using the salon portal.',
                passwordChangeRequired: true
            });
        }
        return next();
    } catch (error) {
        console.error('Employee authentication error:', error);
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        return res.status(500).json({ error: 'Could not verify the employee account.' });
    }
}

const adminOnlyPagePaths = new Set([
    '/admin-dashboard', '/admin-dashboard.html', '/admin', '/admin.html',
    '/employee-view', '/employee-view.html',
    '/user-access', '/user-access.html'
]);
const accessPagePathSet = new Set(accessPageDefinitions.flatMap(definition => [
    definition.path,
    `${definition.path}.html`
]));
const employeeOnlyPagePaths = new Set([
    '/employee-dashboard', '/employee-dashboard.html',
    '/profile', '/profile.html',
    '/settings', '/settings.html',
    '/attendance', '/attendance.html',
    '/customers', '/customers.html'
]);
const authenticatedPagePaths = new Set(['/password-change', '/password-change.html']);
const legacyPageRedirects = new Map([
    ['/admin', '/admin-dashboard'],
    ['/admin.html', '/admin-dashboard'],
    ['/forms', '/employee-dashboard'],
    ['/forms.html', '/employee-dashboard'],
    ['/customer-entry', '/collection-table'],
    ['/index.html', '/collection-table'],
    ['/data-port', '/bulk-entry'],
    ['/data-port.html', '/bulk-entry']
]);

async function requirePageAuth(req, res, next) {
    if (!requestCredential(req)) return res.redirect('/login');
    const pagePath = req.path.replace(/\/+$/, '') || '/';
    return verifyEmployee(req, res, () => {
        if (adminOnlyPagePaths.has(pagePath) && !isAdmin(req.employee)) {
            return res.redirect('/employee-dashboard');
        }
        if (employeeOnlyPagePaths.has(pagePath) && isAdmin(req.employee)) {
            return res.redirect('/admin-dashboard');
        }
        const pageKey = pageKeyForPath(pagePath);
        if (!pageKey || isAdmin(req.employee)) return next();
        return hasPageAccess(req.employee, pageKey)
            .then(allowed => allowed ? next() : res.redirect('/employee-dashboard'))
            .catch(next);
    });
}

function requireAdmin(req, res, next) {
    if (!isAdmin(req.employee)) {
        return res.status(403).json({ error: 'Administrator access is required.' });
    }
    return next();
}

function requireSuperAdmin(req, res, next) {
    if (!isSuperAdmin(req.employee)) {
        return res.status(403).json({ error: 'Super Admin access is required.' });
    }
    return next();
}

function requireAnyPageAccess(...pageKeys) {
    return async (req, res, next) => {
        try {
            for (const pageKey of pageKeys) {
                if (await hasPageAccess(req.employee, pageKey)) return next();
            }
            return res.status(403).json({ error: 'You do not have access to this page.' });
        } catch (error) {
            return next(error);
        }
    };
}

function requireActionPermission(moduleKey, action) {
    return async (req, res, next) => {
        try {
            if (await hasActionAccess(req.employee, moduleKey, action)) return next();
            return res.status(403).json({ error: 'You do not have permission for this action.' });
        } catch (error) {
            return next(error);
        }
    };
}

function permissionAllows(config, employee, category) {
    if (isAdmin(employee)) return true;
    const aliases = category.trim().toLowerCase() === 'customer entry'
        ? ['customer entry', 'counter cash']
        : [category.trim().toLowerCase()];
    return Boolean(config?.permissions.some(permission =>
        aliases.includes(permission.name.trim().toLowerCase()) &&
        permission.employeeIds.some(id => id.equals(employee._id))
    ));
}

async function employeeHasPermission(employee, category) {
    if (isAdmin(employee)) return true;
    const config = await AppConfig.findOne({ key: 'collection' }).lean();
    return permissionAllows(config, employee, category);
}

function accessRuleFor(config, employee) {
    return config?.accessRules?.find(rule => String(rule.employeeId) === String(employee?._id)) || null;
}

function defaultPageAccess(config, employee, definition) {
    if (isAdmin(employee)) return true;
    if (definition.adminOnly) return false;
    if (definition.key === 'dashboard') return true;
    return definition.permission ? permissionAllows(config, employee, definition.permission) : false;
}

function defaultActionAccess(config, employee, definition, action) {
    if (isAdmin(employee)) return true;
    if (definition.adminOnly) return false;
    if (definition.group) return false;
    if (action === 'deactivate' || action === 'export') return false;
    return definition.permission ? permissionAllows(config, employee, definition.permission) : false;
}

function accessRuleAllowsPage(rule, definition) {
    if (!rule) return false;
    return rule.pages.includes(definition.key) ||
        Boolean(definition.group && rule.pages.includes(definition.group));
}

function accessRuleAllowsAction(actionRule, definition, action) {
    if (!actionRule) return false;
    if (definition.combinedDelete && (action === 'delete' || action === 'deactivate')) {
        return Boolean(actionRule.delete || actionRule.deactivate);
    }
    return Boolean(actionRule[action]);
}

async function hasPageAccess(employee, pageKey) {
    if (isAdmin(employee) || pageKey === 'dashboard') return true;
    const definition = accessPageDefinitions.find(item => item.key === pageKey);
    if (!definition || definition.adminOnly) return false;
    const config = await AppConfig.findOne({ key: 'collection' }).lean();
    const rule = accessRuleFor(config, employee);
    if (rule) return accessRuleAllowsPage(rule, definition);
    return defaultPageAccess(config, employee, definition);
}

async function hasActionAccess(employee, moduleKey, action) {
    if (isAdmin(employee)) return true;
    if (moduleKey === 'expense') {
        // Employees can always view, add, edit, or delete their own advance records
        if (['view', 'add', 'edit', 'delete'].includes(action)) return true;
    }
    const definition = accessActionDefinitions.find(item => item.key === moduleKey);
    if (!definition || definition.adminOnly) return false;
    const config = await AppConfig.findOne({ key: 'collection' }).lean();
    const rule = accessRuleFor(config, employee);
    if (rule) {
        const actionRule = rule.actions?.find(item => item.module === moduleKey);
        return accessRuleAllowsAction(actionRule, definition, action);
    }
    return defaultActionAccess(config, employee, definition, action);
}

function pageKeyForPath(pathname) {
    const normalizedPath = (pathname.replace(/\/+$/, '') || '/').replace(/\.html$/i, '');
    return accessPageDefinitions.find(definition => definition.path === normalizedPath)?.key || null;
}

function accessSnapshotFromConfig(config, employee) {
    const rule = accessRuleFor(config, employee);
    const pages = Object.fromEntries(accessPageDefinitions.map(definition => [
        definition.key,
        isAdmin(employee)
            ? true
            : definition.adminOnly
                ? false
                : rule
                    ? accessRuleAllowsPage(rule, definition)
                    : defaultPageAccess(config, employee, definition)
    ]));
    const actions = Object.fromEntries(accessActionDefinitions.map(definition => {
        const actionRule = rule?.actions?.find(item => item.module === definition.key);
        return [definition.key, Object.fromEntries(allAccessActions.map(action => [
            action,
            isAdmin(employee)
                ? true
                : definition.adminOnly
                    ? false
                    : rule
                        ? accessRuleAllowsAction(actionRule, definition, action)
                        : defaultActionAccess(config, employee, definition, action)
        ]))];
    }));
    return { pages, actions };
}

async function accessSnapshot(employee) {
    const config = await AppConfig.findOne({ key: 'collection' }).lean();
    return accessSnapshotFromConfig(config, employee);
}

function applyStatusFilter(filter, value) {
    const status = String(value || 'Active').trim().toLowerCase();
    if (status === 'all') return;
    if (status === 'inactive' || status === 'in-active') {
        filter.status = 'Inactive';
        return;
    }
    filter.status = { $ne: 'Inactive' };
}

async function employeeCollectionFilter(employee) {
    if (isAdmin(employee)) return {};
    const clauses = [{ staffId: employee._id }];
    const employeeNameMatches = await Employee.countDocuments({
        employeeName: employee.employeeName,
        status: 'Active'
    }).limit(2);
    if (employeeNameMatches === 1) {
        clauses.push({
            staffId: { $exists: false },
            staff: employee.employeeName
        });
    }
    return { $or: clauses };
}

function employeePublicDetails(employee) {
    const admin = isAdmin(employee);
    return {
        employeeId: employee?._id ? String(employee._id) : '',
        employeeName: employee?.employeeName || 'Admin',
        userId: employee?.userId || bootstrapAdminUserId,
        emailAddress: employee?.emailAddress || '',
        role: admin ? 'Admin' : 'Employee',
        accountType: admin ? (employee?._id ? 'Admin' : 'Super Admin') : 'Employee',
        photoUrl: employee?.photoUrl || '',
        mustChangePassword: employee?.mustChangePassword === true,
        salaryMode: employee?.salaryMode || 'percentage',
        salaryPercentage: employee?.salaryPercentage ?? 50,
        fixedMonthlySalary: employee?.fixedMonthlySalary ?? 0
    };
}

function normalizeEmployee(input, fieldDefinitions = []) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new EmployeeInputError('Employee details are required.');
    }
    const employeeId = String(input.employeeId ?? '').trim();
    const employeeName = String(input.employeeName ?? '').trim();
    const statusText = String(input.status ?? 'Active').trim().toLowerCase();
    const status = statusText === 'inactive' ? 'Inactive' : 'Active';
    const sr = input.sr === '' || input.sr === undefined || input.sr === null
        ? undefined
        : Number(input.sr);

    if (!employeeId) {
        throw new EmployeeInputError('Employee ID is required.');
    }
    if (!employeeName) {
        throw new EmployeeInputError(`Employee Name is required for Employee ID ${employeeId}.`);
    }
    if (statusText && !['active', 'inactive'].includes(statusText)) {
        throw new EmployeeInputError(`Status must be Active or Inactive for Employee ID ${employeeId}.`);
    }
    if (sr !== undefined && (!Number.isSafeInteger(sr) || sr < 0)) {
        throw new EmployeeInputError(`SR must be a non-negative number for Employee ID ${employeeId}.`);
    }
    const emailAddress = String(input.emailAddress ?? '').trim().toLowerCase();
    if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
        throw new EmployeeInputError(`Enter a valid email address for Employee ID ${employeeId}.`);
    }
    const rawMobileNumber = String(input.mobileNumber ?? '').trim();
    const mobileNumber = rawMobileNumber.replace(/[^\d]/g, '');
    if (!/^\d{10,15}$/.test(mobileNumber)) {
        throw new EmployeeInputError(`Enter a valid mobile number with 10 to 15 digits for Employee ID ${employeeId}.`);
    }
    const photoUrl = String(input.photoUrl ?? '').trim();
    if (photoUrl.startsWith('data:')) {
        if (photoUrl.length > 1000000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photoUrl)) {
            throw new EmployeeInputError(`Upload a valid JPG photo under 1 MB for Employee ID ${employeeId}.`);
        }
    } else if (photoUrl) {
        if (photoUrl.length > 1000) {
            throw new EmployeeInputError(`Photo URL must be 1000 characters or fewer for Employee ID ${employeeId}.`);
        }
        let parsedPhotoUrl;
        try {
            parsedPhotoUrl = new URL(photoUrl);
        } catch {
            throw new EmployeeInputError(`Photo URL is invalid for Employee ID ${employeeId}.`);
        }
        if (!['http:', 'https:'].includes(parsedPhotoUrl.protocol)) {
            throw new EmployeeInputError(`Photo URL must use http or https for Employee ID ${employeeId}.`);
        }
    }
    const normalizeDateField = (fieldName, label) => {
        const value = String(input[fieldName] ?? '').trim();
        if (!value) return '';
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        const date = dateMatch ? new Date(`${value}T00:00:00.000Z`) : null;
        if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw new EmployeeInputError(`${label} must be a valid date for Employee ID ${employeeId}.`);
        }
        return value;
    };
    const joiningDate = normalizeDateField('joiningDate', 'Joining Date');
    const dateOfBirth = normalizeDateField('dateOfBirth', 'Date of Birth');
    const panNumber = String(input.panNumber ?? '').trim().toUpperCase();
    if (panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber)) {
        throw new EmployeeInputError(`Enter a valid 10-character PAN number for Employee ID ${employeeId}.`);
    }
    const aadhaarCardNumber = String(input.aadhaarCardNumber ?? '').replace(/[\s-]/g, '');
    if (aadhaarCardNumber && !/^\d{12}$/.test(aadhaarCardNumber)) {
        throw new EmployeeInputError(`Enter a valid 12-digit Aadhaar Card number for Employee ID ${employeeId}.`);
    }
    const pinCode = String(input.pinCode ?? '').trim();
    if (pinCode && !/^\d{6}$/.test(pinCode)) {
        throw new EmployeeInputError(`Enter a valid 6-digit Pin for Employee ID ${employeeId}.`);
    }
    const rawAlternateMobileNumber = String(input.alternateMobileNumber ?? '').trim();
    const alternateMobileNumber = rawAlternateMobileNumber.replace(/[^\d]/g, '');
    if (alternateMobileNumber && !/^\d{10,15}$/.test(alternateMobileNumber)) {
        throw new EmployeeInputError(`Enter a valid alternate mobile number with 10 to 15 digits for Employee ID ${employeeId}.`);
    }

    const suppliedCustomFields = input.customFields && typeof input.customFields === 'object' &&
        !Array.isArray(input.customFields) ? input.customFields : {};
    const salaryMode = String(input.salaryMode ?? 'percentage').trim().toLowerCase();
    const salaryPercentage = input.salaryPercentage === '' || input.salaryPercentage === undefined
        ? 50
        : Number(input.salaryPercentage);
    const fixedMonthlySalary = input.fixedMonthlySalary === '' || input.fixedMonthlySalary === undefined
        ? 0
        : Number(input.fixedMonthlySalary);
    if (!['percentage', 'fixed'].includes(salaryMode) ||
        !Number.isFinite(salaryPercentage) || salaryPercentage < 0 || salaryPercentage > 100 ||
        !Number.isFinite(fixedMonthlySalary) || fixedMonthlySalary < 0) {
        throw new EmployeeInputError(`Enter a valid salary mode and amount for Employee ID ${employeeId}.`);
    }
    const roleText = String(input.role ?? 'Employee').trim().toLowerCase();
    if (!['employee', 'admin', 'administrator', 'super admin', 'superadmin', 'super_admin'].includes(roleText)) {
        throw new EmployeeInputError(`Role must be Employee or Admin for Employee ID ${employeeId}.`);
    }
    const address = String(input.address ?? '').trim();
    const city = String(input.city ?? '').trim();
    const state = String(input.state ?? '').trim();
    if (address.length > 500 || city.length > 100 || state.length > 100) {
        throw new EmployeeInputError(`Address, City, or State is too long for Employee ID ${employeeId}.`);
    }
    const customFields = {};
    for (const field of fieldDefinitions) {
        if (!Object.hasOwn(suppliedCustomFields, field.key)) continue;
        const value = String(suppliedCustomFields[field.key] ?? '').trim();
        if (value.length > 500) {
            throw new EmployeeInputError(`${field.label} must be 500 characters or fewer for Employee ID ${employeeId}.`);
        }
        customFields[field.key] = value;
    }

    return {
        ...(sr === undefined ? {} : { sr }),
        employeeId,
        emailAddress,
        mobileNumber,
        employeeName,
        status,
        joiningDate,
        dateOfBirth,
        panNumber,
        aadhaarCardNumber,
        address,
        city,
        state,
        pinCode,
        alternateMobileNumber,
        expenseType: String(input.expenseType ?? '').trim(),
        expenseTypes: [],
        userId: String(input.userId ?? '').trim().toLowerCase(),
        role: ['admin', 'administrator', 'super admin', 'superadmin', 'super_admin'].includes(roleText) ? 'Admin' : 'Employee',
        salaryMode,
        salaryPercentage,
        fixedMonthlySalary,
        photoUrl,
        customFields
    };
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                value += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                value += character;
            }
        } else if (character === '"' && value.length === 0) {
            quoted = true;
        } else if (character === ',') {
            row.push(value);
            value = '';
        } else if (character === '\n' || character === '\r') {
            if (character === '\r' && text[index + 1] === '\n') index += 1;
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
        } else {
            value += character;
        }
    }
    row.push(value);
    if (row.some(cell => cell.trim())) rows.push(row);
    return rows;
}

function normalizeHeader(value) {
    return String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function isRedundantMobileField(field) {
    return ['mobileno', 'mobilenumber'].includes(normalizeHeader(field.label));
}

function getCell(row, headerIndexes, aliases) {
    for (const alias of aliases) {
        const index = headerIndexes.get(alias);
        if (index !== undefined) return row[index] ?? '';
    }
    return '';
}

function toCsv(rows) {
    return `\uFEFF${rows.map(row => row.map(value => {
        const text = value instanceof Date ? value.toISOString() : String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n')}`;
}

function rowsToEmployees(rows, fieldDefinitions = []) {
    if (!rows.length) throw new Error('The uploaded file is empty.');
    const headerIndexes = new Map();
    rows[0].forEach((header, index) => headerIndexes.set(normalizeHeader(header), index));
    const employeeIdIndex = headerIndexes.get('employeeid');
    const employeeNameIndex = headerIndexes.get('employeename');
    if (employeeIdIndex === undefined || employeeNameIndex === undefined) {
        throw new Error('The file must include Employee ID and Employee Name columns.');
    }

    const employees = [];
    const errors = [];
    for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row.some(cell => String(cell ?? '').trim())) continue;
        const spreadsheetDate = aliases => {
            const value = getCell(row, headerIndexes, aliases);
            return value instanceof Date && !Number.isNaN(value.getTime())
                ? value.toISOString().slice(0, 10)
                : String(value ?? '').trim().slice(0, 10);
        };
        try {
            employees.push(normalizeEmployee({
                sr: getCell(row, headerIndexes, ['sr']),
                employeeId: getCell(row, headerIndexes, ['employeeid']),
                emailAddress: getCell(row, headerIndexes, ['emailaddress', 'email']),
                mobileNumber: getCell(row, headerIndexes, ['mobilenumber', 'mobile', 'phone', 'phonenumber']),
                employeeName: getCell(row, headerIndexes, ['employeename', 'name']),
                status: getCell(row, headerIndexes, ['status']),
                joiningDate: spreadsheetDate(['joiningdate']),
                dateOfBirth: spreadsheetDate(['dateofbirth', 'dob']),
                panNumber: getCell(row, headerIndexes, ['panno', 'pannumber', 'pan']),
                aadhaarCardNumber: getCell(row, headerIndexes, ['aadhaarcardno', 'aadhaarcardnumber', 'aadhaar', 'aadhar']),
                address: getCell(row, headerIndexes, ['address']),
                city: getCell(row, headerIndexes, ['city']),
                state: getCell(row, headerIndexes, ['state']),
                pinCode: getCell(row, headerIndexes, ['pin', 'pincode']),
                alternateMobileNumber: getCell(row, headerIndexes, ['alternatemobileno', 'alternatemobilenumber', 'alternatemobile']),
                expenseType: getCell(row, headerIndexes, ['expensetypes', 'expensetype']),
                userId: getCell(row, headerIndexes, ['userid']),
                role: getCell(row, headerIndexes, ['role']),
                salaryMode: getCell(row, headerIndexes, ['salarymode']) || 'percentage',
                salaryPercentage: getCell(row, headerIndexes, ['salarypercentage', 'commissionpercentage']),
                fixedMonthlySalary: getCell(row, headerIndexes, ['fixedmonthlysalary', 'fixedsalary']),
                photoUrl: getCell(row, headerIndexes, ['photourl']),
                customFields: Object.fromEntries(fieldDefinitions
                    .filter(field => headerIndexes.has(normalizeHeader(field.label)))
                    .map(field => [
                    field.key,
                    getCell(row, headerIndexes, [normalizeHeader(field.label)])
                ]))
            }, fieldDefinitions));
        } catch (error) {
            errors.push(`Row ${index + 1}: ${error.message}`);
        }
    }
    return { employees, errors };
}

app.use((req, res, next) => {
    const normalizedPath = req.path.replace(/\/+$/, '') || '/';
    if (req.method === 'GET' && legacyPageRedirects.has(normalizedPath)) {
        return res.redirect(legacyPageRedirects.get(normalizedPath));
    }
    const isProtectedHtml = req.method === 'GET' &&
        normalizedPath.endsWith('.html') && normalizedPath !== '/login.html' && normalizedPath !== '/salary_expense_ui_preview.html';
    const isProtectedRoute = req.method === 'GET' && (
        adminOnlyPagePaths.has(normalizedPath) || employeeOnlyPagePaths.has(normalizedPath) ||
        authenticatedPagePaths.has(normalizedPath) || accessPagePathSet.has(normalizedPath) ||
        normalizedPath.endsWith('-entry') || normalizedPath.endsWith('-table')
    );
    if (isProtectedHtml || isProtectedRoute) return requirePageAuth(req, res, next);
    return next();
});

app.use(express.static(PUBLIC_DIR, { index: false }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/forms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forms.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/employee-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-dashboard.html'));
});

app.get('/employee-view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-dashboard.html'));
});

app.get('/employee-view.html', (req, res) => {
    res.redirect('/employee-view');
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'attendance.html'));
});

app.get('/customers', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customers.html'));
});

app.get('/employee-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-entry.html'));
});

app.get('/user-access', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user-access.html'));
});

app.get('/password-change', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'password-change.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/collection-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-entry.html'));
});

app.get('/expense-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-entry.html'));
});

app.get('/salary-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-entry.html'));
});

app.get('/counter-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-entry.html'));
});

app.get('/collection-table', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-table.html'));
});

app.get('/expense-table', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-table.html'));
});

app.get('/salary-table', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-table.html'));
});

app.get('/counter-table', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'module-table.html'));
});

app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

app.get('/activity-report', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'activity-report.html'));
});

app.get('/rate-list', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rate-list.html'));
});

app.get('/bulk-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bulk-entry.html'));
});

app.get('/customer-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    return res.status(connected ? 200 : 503).json({
        status: connected ? 'ok' : 'degraded',
        server: 'running',
        database: connected ? 'connected' : 'disconnected'
    });
});

app.get('/config', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

app.get('/import-validation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'import-validation.html'));
});

app.get('/employees', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employees.html'));
});

app.get('/expense-types', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'expense-types.html'));
});

app.get('/shop-details', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shop-details.html'));
});

app.get('/data-port', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'data-port.html'));
});

app.get('/api/public-config', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const config = await AppConfig.findOne({ key: 'collection' }).lean();
        return res.json({
            googleAuthRequired,
            allowPreviousEntry: config?.allowPreviousEntry ?? false,
            todayDate: getTodayDate()
        });
    } catch (error) {
        console.error('Public configuration read error:', error);
        return res.status(500).json({ error: 'Could not load app configuration.' });
    }
});

app.get('/api/shop-branding', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const details = await ShopDetails.findOne({ key: 'primary' }).lean();
        const settings = { ...defaultShopDetails, ...(details?.settings || {}) };
        const yes = value => String(value ?? '').trim().toLowerCase() === 'yes';
        const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value ?? '').trim())
            ? String(value).trim()
            : fallback;
        const size = (value, fallback) => {
            const number = Number(value);
            return Number.isFinite(number) && number > 0 ? number : fallback;
        };
        const slides = [1, 2, 3].map(index => ({
            image: String(settings[`Login Slide ${index} Image`] || '').trim(),
            title: String(settings[`Login Slide ${index} Title`] || '').trim(),
            description: String(settings[`Login Slide ${index} Description`] || '').trim()
        })).filter(slide => slide.image || slide.title || slide.description);
        return res.json({
            name: settings['Brand Name'] || '',
            description: settings['Brand Description'] || '',
            tagline: settings.Tagline || '',
            logoUrl: settings['Logo URL'] || '',
            faviconUrl: settings['Favicon URL'] || '',
            login: {
                theme: ['Light', 'Dark', 'Combination'].includes(settings['Login Page Theme'])
                    ? settings['Login Page Theme']
                    : 'Combination',
                logoWidth: size(settings['Login Logo Width'], 64),
                logoHeight: size(settings['Login Logo Height'], 64),
                nameSize: size(settings['Login Name Font Size'], 34),
                slideDuration: Math.min(60000, Math.max(1000, size(settings['Login Slide Duration'], 4000))),
                slides,
                showPassword: yes(settings['Show Password Login']),
                showGoogle: yes(settings['Show Google Login']),
                showMobile: yes(settings['Show Mobile Login']),
                showFace: yes(settings['Show Face Login']),
                buttonStyle: settings['Button Style'] === 'Mix' ? 'Mix' : 'Solid',
                buttonColor: hex(settings['Button Color'], '#C9A227'),
                buttonColor2: hex(settings['Button Color 2'], '#8A6D1B'),
                colors: {
                    accent: hex(settings['Accent Color'], '#C9A227'),
                    header: hex(settings['Header Color'], '#211A16'),
                    headerText: hex(settings['Header Text Color'], '#FFFFFF'),
                    body: hex(settings['Body Background'], '#F7F5F2'),
                    card: hex(settings['Card Background'], '#FFFFFF')
                }
            }
        });
    } catch (error) {
        console.error('Public shop branding read error:', error);
        return res.status(500).json({ error: 'Could not load shop branding.' });
    }
});

app.get('/api/setup-status', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const storedAdmin = await AdminCredential.exists({ key: 'primary' });
        const employeeAdmin = await Employee.exists({
            status: 'Active',
            role: { $regex: /^(admin|administrator|super[\s_-]*admin)$/i },
            passwordHash: { $exists: true, $ne: '' }
        });
        return res.json({
            setupRequired: !(bootstrapAdminPasswordHash && bootstrapAdminUserId) &&
                !storedAdmin && !employeeAdmin
        });
    } catch (error) {
        console.error('Administrator setup status error:', error);
        return res.status(500).json({ error: 'Could not check administrator setup status.' });
    }
});

app.post('/api/setup-admin', async (req, res) => {
    const remoteAddress = req.socket.remoteAddress || '';
    const isLoopback = remoteAddress === '::1' || remoteAddress === '127.0.0.1' ||
        remoteAddress.startsWith('::ffff:127.');
    const localHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
    let originHost = '';
    try {
        originHost = new URL(req.get('origin') || '').host.toLowerCase();
    } catch {
        originHost = '';
    }
    const requestHost = String(req.get('host') || '').toLowerCase();
    if (!isLoopback || !localHosts.has(originHost) || originHost !== requestHost) {
        return res.status(403).json({ error: 'First administrator setup is allowed only from the server itself.' });
    }
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const userId = String(req.body.userId ?? '').trim().toLowerCase();
        const password = String(req.body.password ?? '');
        if (!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(userId)) {
            return res.status(400).json({ error: 'User ID must be 3 to 100 characters and use letters, numbers, dots, underscores or hyphens.' });
        }
        if (password.length < 12 || password.length > 200) {
            return res.status(400).json({ error: 'Administrator password must be at least 12 characters.' });
        }
        const [storedAdmin, employeeAdmin] = await Promise.all([
            AdminCredential.exists({ key: 'primary' }),
            Employee.exists({
                status: 'Active',
                role: { $regex: /^(admin|administrator|super[\s_-]*admin)$/i },
                passwordHash: { $exists: true, $ne: '' }
            })
        ]);
        if ((bootstrapAdminPasswordHash && bootstrapAdminUserId) || storedAdmin || employeeAdmin) {
            return res.status(409).json({ error: 'An administrator account is already configured.' });
        }
        if (await Employee.exists({ userId })) {
            return res.status(409).json({ error: 'That User ID is already assigned to an employee.' });
        }
        await AdminCredential.create({
            key: 'primary',
            userId,
            passwordHash: await bcrypt.hash(password, 10)
        });
        const token = jwt.sign({
            kind: 'salon-session',
            role: 'Admin',
            userId,
            sub: 'bootstrap-admin'
        }, sessionSecret, { expiresIn: '8h' });
        setSessionCookie(res, token);
        await recordAudit(req, {
            action: 'ADMIN_SETUP',
            page: 'Login',
            module: 'Authentication',
            newValue: { userId, role: 'Admin' }
        }, { employeeName: 'Admin', userId, role: 'Admin' });
        return res.status(201).json({
            token,
            employee: employeePublicDetails({ role: 'Admin', userId, employeeName: 'Admin' })
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'An administrator account has already been configured.' });
        }
        console.error('Administrator setup error:', error);
        return res.status(500).json({ error: 'Could not create the administrator account.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const userId = String(req.body.userId ?? '').trim().toLowerCase();
        const password = String(req.body.password ?? '');
        if (!userId || !password || userId.length > 100 || password.length > 200) {
            return res.status(400).json({ error: 'Enter your User ID and password.' });
        }
        const attemptKey = userId;
        const attempt = loginAttempts.get(attemptKey) || { failures: 0, blocked: false };
        if (attempt.blocked) {
            return res.status(423).json({
                error: 'Account blocked after 3 wrong attempts. Use Forgot Password to reset it.',
                blocked: true,
                attemptsLeft: 0
            });
        }
        const maximumAttempts = 3;
        const recordFailure = () => {
            attempt.failures += 1;
            if (attempt.failures >= maximumAttempts) {
                attempt.failures = maximumAttempts;
                attempt.blocked = true;
            }
            loginAttempts.set(attemptKey, attempt);
            return attempt.blocked;
        };
        const failureResponse = () => {
            const attemptsLeft = Math.max(0, maximumAttempts - attempt.failures);
            if (attempt.blocked) {
                return res.status(423).json({
                    error: 'Account blocked after 3 wrong attempts. Use Forgot Password to reset it.',
                    blocked: true,
                    attemptsLeft: 0
                });
            }
            return res.status(401).json({
                error: `User ID or password is incorrect. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`,
                blocked: false,
                attemptsLeft
            });
        };

        const storedAdminAccount = await AdminCredential.findOne({ key: 'primary' })
            .select('+passwordHash');
        if (storedAdminAccount && userId === storedAdminAccount.userId &&
            await bcrypt.compare(password, storedAdminAccount.passwordHash)) {
            loginAttempts.delete(attemptKey);
            const token = jwt.sign({
                kind: 'salon-session',
                role: 'Admin',
                userId,
                authVersion: storedAdminAccount.authVersion,
                sub: 'bootstrap-admin'
            }, sessionSecret, { expiresIn: '8h' });
            setSessionCookie(res, token);
            await recordAudit(req, {
                action: 'LOGIN',
                page: 'Login',
                module: 'Authentication',
                newValue: { userId, role: 'Admin' }
            }, { employeeName: 'Admin', userId, role: 'Admin' });
            return res.json({
                token,
                employee: employeePublicDetails({ role: 'Admin', userId, employeeName: 'Admin' })
            });
        }

        if (!storedAdminAccount && bootstrapAdminPasswordHash && userId === bootstrapAdminUserId &&
            await bcrypt.compare(password, bootstrapAdminPasswordHash)) {
            loginAttempts.delete(attemptKey);
            const token = jwt.sign({
                kind: 'salon-session',
                role: 'Admin',
                userId,
                sub: 'bootstrap-admin'
            }, sessionSecret, { expiresIn: '8h' });
            setSessionCookie(res, token);
            await recordAudit(req, {
                action: 'LOGIN',
                page: 'Login',
                module: 'Authentication',
                newValue: { userId, role: 'Admin' }
            }, { employeeName: 'Admin', userId, role: 'Admin' });
            return res.json({
                token,
                employee: employeePublicDetails({ role: 'Admin', userId, employeeName: 'Admin' })
            });
        }

        const matches = await Employee.find({ userId, status: 'Active' })
            .select('+passwordHash')
            .limit(2);
        if (matches.length > 1) {
            if (recordFailure()) return failureResponse();
            const attemptsLeft = Math.max(0, maximumAttempts - attempt.failures);
            return res.status(409).json({
                error: `This User ID is duplicated. Ask admin to correct the employee records. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`,
                blocked: false,
                attemptsLeft
            });
        }
        const employee = matches[0];
        const isDefaultPassword = employee?.mustChangePassword && password === '1234';
        if (!employee?.passwordHash ||
            (!isDefaultPassword && !await bcrypt.compare(password, employee.passwordHash))) {
            recordFailure();
            return failureResponse();
        }
        if (isDefaultPassword && !await bcrypt.compare(password, employee.passwordHash)) {
            employee.passwordHash = await bcrypt.hash('1234', 10);
            await employee.save();
        }

        loginAttempts.delete(attemptKey);
        const role = isAdmin(employee) ? 'Admin' : 'Employee';
        const token = jwt.sign({
            kind: 'salon-session',
            role,
            userId: employee.userId,
            sub: String(employee._id)
        }, sessionSecret, { expiresIn: '8h' });
        setSessionCookie(res, token);
        await recordAudit(req, {
            action: 'LOGIN',
            page: 'Login',
            module: 'Authentication',
            newValue: { userId: employee.userId, role }
        }, employee);
        return res.json({ token, employee: employeePublicDetails(employee) });
    } catch (error) {
        console.error('User ID login error:', error);
        return res.status(500).json({ error: 'Could not sign in. Please try again.' });
    }
});

app.post('/api/forgot-password/verify', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const employeeId = String(req.body.employeeId ?? '').trim();
        const userId = String(req.body.userId ?? '').trim().toLowerCase();
        if (!employeeId || !userId || employeeId.length > 100 || userId.length > 100) {
            return res.status(400).json({ error: 'Enter your employee code and User ID.' });
        }
        const throttleKey = `forgot:${userId}`;
        const throttle = loginAttempts.get(throttleKey) || { failures: 0, blockedUntil: 0 };
        if (throttle.blockedUntil > Date.now()) {
            return res.status(429).json({ error: 'Too many reset attempts. Try again after 10 minutes.' });
        }
        const escaped = employeeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const employee = await Employee.findOne({
            employeeId: { $regex: `^${escaped}$`, $options: 'i' },
            userId,
            status: 'Active'
        }).select('_id employeeId employeeName role userId');
        if (!employee) {
            throttle.failures += 1;
            if (throttle.failures >= 5) {
                throttle.failures = 0;
                throttle.blockedUntil = Date.now() + 10 * 60 * 1000;
            }
            loginAttempts.set(throttleKey, throttle);
            return res.status(401).json({ error: 'Employee code and User ID do not match an active employee.' });
        }
        loginAttempts.delete(throttleKey);
        for (const [key, entry] of passwordResetTokens) {
            if (entry.employeeObjectId === String(employee._id)) passwordResetTokens.delete(key);
        }
        const token = crypto.randomBytes(24).toString('hex');
        passwordResetTokens.set(token, {
            employeeObjectId: String(employee._id),
            employeeId: employee.employeeId,
            userId: employee.userId,
            expiresAt: Date.now() + 10 * 60 * 1000
        });
        return res.json({
            token,
            expiresInMinutes: 10,
            message: 'Employee code and User ID verified. Set a new password.'
        });
    } catch (error) {
        console.error('Forgot password verify error:', error);
        return res.status(500).json({ error: 'Could not verify the employee details. Please try again.' });
    }
});

app.post('/api/forgot-password/reset', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database connection is unavailable. Check the Atlas network access list and try again.' });
        }
        const token = String(req.body.token ?? '').trim();
        const newPassword = String(req.body.newPassword ?? '');
        if (!token) {
            return res.status(400).json({ error: 'Reset session expired. Verify your employee code again.' });
        }
        if (newPassword.length < 8 || newPassword.length > 200) {
            return res.status(400).json({ error: 'New password must be between 8 and 200 characters.' });
        }
        const reset = passwordResetTokens.get(token);
        if (!reset || reset.expiresAt < Date.now()) {
            passwordResetTokens.delete(token);
            return res.status(400).json({ error: 'Reset session expired. Verify your employee code again.' });
        }
        const employee = await Employee.findById(reset.employeeObjectId)
            .select('employeeId employeeName role userId status');
        if (!employee || employee.status !== 'Active') {
            passwordResetTokens.delete(token);
            return res.status(400).json({ error: 'This employee account is not active. Contact the administrator.' });
        }
        employee.passwordHash = await bcrypt.hash(newPassword, 10);
        employee.mustChangePassword = false;
        await employee.save();
        passwordResetTokens.delete(token);
        loginAttempts.delete(employee.userId);
        await recordAudit(req, {
            action: 'FORGOT_PASSWORD_RESET',
            page: 'Login',
            module: 'Authentication',
            recordType: 'Employee',
            recordId: String(employee._id),
            newValue: { userId: employee.userId, method: 'Employee code and User ID verification' }
        }, employee);
        return res.json({ message: 'Password reset successfully. You can sign in with the new password.' });
    } catch (error) {
        console.error('Forgot password reset error:', error);
        return res.status(500).json({ error: 'Could not reset the password. Please try again.' });
    }
});

app.post('/api/change-password', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!req.employee?._id) {
            return res.status(400).json({ error: 'This administrator account does not use employee password settings.' });
        }
        const currentPassword = String(req.body.currentPassword ?? '');
        const newPassword = String(req.body.newPassword ?? '');
        if (newPassword.length < 8 || newPassword.length > 200) {
            return res.status(400).json({ error: 'New password must be between 8 and 200 characters.' });
        }
        const employee = await Employee.findById(req.employee._id).select('+passwordHash');
        if (!employee?.passwordHash || !await bcrypt.compare(currentPassword, employee.passwordHash)) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Choose a password different from your current password.' });
        }
        employee.passwordHash = await bcrypt.hash(newPassword, 10);
        employee.mustChangePassword = false;
        await employee.save();
        await recordAudit(req, {
            action: 'PASSWORD_CHANGE',
            page: 'Password & Security',
            module: 'Authentication',
            recordType: 'Employee',
            recordId: String(employee._id),
            newValue: { result: 'Password changed by employee.' },
            metadata: { employeeName: employee.employeeName }
        });
        return res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Employee password change error:', error);
        return res.status(500).json({ error: 'Could not change the password.' });
    }
});

app.post('/api/admin-credentials', requireSecureAuth, verifyEmployee, requireAdmin, async (req, res) => {
    try {
        if (req.employee?._id) {
            return res.status(400).json({ error: 'Use the Employee Master to manage employee login credentials.' });
        }
        const currentPassword = String(req.body.currentPassword ?? '');
        const userId = String(req.body.userId ?? '').trim().toLowerCase();
        const newPassword = String(req.body.newPassword ?? '');
        if (!currentPassword) {
            return res.status(400).json({ error: 'Enter your current administrator password.' });
        }
        if (!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(userId)) {
            return res.status(400).json({ error: 'User ID must be 3 to 100 characters and use letters, numbers, dots, underscores or hyphens.' });
        }
        if (newPassword.length < 12 || newPassword.length > 200) {
            return res.status(400).json({ error: 'Administrator password must be between 12 and 200 characters.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Choose a new password different from your current password.' });
        }
        const storedAdmin = await AdminCredential.findOne({ key: 'primary' }).select('+passwordHash');
        if (storedAdmin) {
            if (storedAdmin.userId !== req.employee.userId ||
                !await bcrypt.compare(currentPassword, storedAdmin.passwordHash)) {
                return res.status(401).json({ error: 'Current administrator password is incorrect.' });
            }
        } else if (
            req.employee.userId !== bootstrapAdminUserId ||
            !bootstrapAdminPasswordHash ||
            !await bcrypt.compare(currentPassword, bootstrapAdminPasswordHash)
        ) {
            return res.status(401).json({ error: 'Current administrator password is incorrect.' });
        }
        if (await Employee.exists({ userId })) {
            return res.status(409).json({ error: 'That User ID is already assigned to an employee.' });
        }
        const updatedAdmin = storedAdmin || new AdminCredential({ key: 'primary' });
        updatedAdmin.userId = userId;
        updatedAdmin.passwordHash = await bcrypt.hash(newPassword, 10);
        updatedAdmin.authVersion = Number(updatedAdmin.authVersion || 0) + 1;
        await updatedAdmin.save();
        const token = jwt.sign({
            kind: 'salon-session',
            role: 'Admin',
            userId,
            authVersion: updatedAdmin.authVersion,
            sub: 'bootstrap-admin'
        }, sessionSecret, { expiresIn: '8h' });
        setSessionCookie(res, token);
        await recordAudit(req, {
            action: 'ADMIN_CREDENTIAL_UPDATE',
            page: 'Admin Dashboard',
            module: 'Authentication',
            oldValue: { userId: req.employee.userId },
            newValue: { userId, role: 'Admin' }
        });
        return res.json({
            message: 'Administrator login ID and password updated.',
            token,
            employee: employeePublicDetails({ role: 'Admin', userId, employeeName: 'Admin' })
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'That administrator User ID is already in use.' });
        }
        console.error('Administrator credential update error:', error);
        return res.status(500).json({ error: 'Could not update administrator credentials.' });
    }
});

app.post('/api/logout', requireSecureAuth, verifyEmployee, async (req, res) => {
    await recordAudit(req, {
        action: 'LOGOUT',
        page: 'Logout',
        module: 'Authentication'
    });
    clearSessionCookie(res);
    return res.json({ message: 'Signed out.' });
});

app.post('/api/activity/page-open', requireSecureAuth, verifyEmployee, async (req, res) => {
    const page = String(req.body?.page || '').trim();
    const route = String(req.body?.route || req.path || '').trim();
    if (!page || page.length > 150 || route.length > 300) {
        return res.status(400).json({ error: 'Page information is invalid.' });
    }
    await recordAudit(req, {
        action: 'PAGE_OPEN',
        page,
        route,
        module: String(req.body?.module || '').trim().slice(0, 100)
    });
    return res.status(204).end();
});

app.get('/api/session', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        const access = await accessSnapshot(req.employee);
        const permissions = isAdmin(req.employee)
            ? defaultPermissionCategories
            : (await Promise.all(defaultPermissionCategories.map(async category =>
                await employeeHasPermission(req.employee, category) ? category : null
            ))).filter(Boolean);
        await ensureDefaultExpenseTypes();
        const activeTypes = await ExpenseType.find({ status: 'Active' }).sort({ sr: 1 }).select('sr name status').lean();
        const activeTypeSerials = new Set(activeTypes.map(item => item.sr));
        const expenseTypes = isAdmin(req.employee)
            ? activeTypes.map(({ sr, name }) => ({ sr, name }))
            : getEmployeeExpenseTypes(req.employee, activeTypes)
                .filter(item => activeTypeSerials.has(Number(item.sr)));
        return res.json({
            employee: employeePublicDetails(req.employee),
            permissions,
            expenseTypes,
            pageAccess: access.pages,
            actionAccess: access.actions
        });
    } catch (error) {
        console.error('Session details error:', error);
        return res.status(500).json({ error: 'Could not load your session details.' });
    }
});

function employeeProfileDetails(employee) {
    return {
        ...employeePublicDetails(employee),
        employeeCode: employee?.employeeId || '',
        mobileNumber: employee?.mobileNumber || '',
        alternateMobileNumber: employee?.alternateMobileNumber || '',
        joiningDate: employee?.joiningDate || '',
        dateOfBirth: employee?.dateOfBirth || '',
        address: employee?.address || '',
        city: employee?.city || '',
        state: employee?.state || '',
        pinCode: employee?.pinCode || '',
        designation: employee?.designation || '',
        status: employee?.status || 'Active'
    };
}

async function employeeDashboardData(employee, month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        const error = new Error('Select a valid month.');
        error.status = 400;
        throw error;
    }
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const todayKey = getTodayDate();
    const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const sparklineStart = new Date(todayStart);
    sparklineStart.setUTCDate(sparklineStart.getUTCDate() - 6);
    const collectionFilter = await employeeCollectionFilter(employee);
    applyStatusFilter(collectionFilter, 'Active');

    const [collections, records, recentCollections, todayRecords, activeEmployees] = await Promise.all([
        CollectionEntry.find({
            ...collectionFilter,
            entryDate: { $gte: start, $lt: end }
        }).sort({ entryDate: -1, createdAt: -1 }).lean(),
        EmployeeRecord.find({
            employeeId: employee._id,
            status: { $ne: 'Inactive' },
            $or: [
                { recordType: { $in: ['expense', 'counter'] }, entryDate: { $gte: start, $lt: end } },
                { recordType: 'salary', salaryMonth: month }
            ]
        }).sort({ entryDate: -1, createdAt: -1 }).lean(),
        CollectionEntry.find({
            ...collectionFilter,
            entryDate: { $gte: sparklineStart, $lt: tomorrowStart }
        }).select('entryDate amount').lean(),
        EmployeeRecord.find({
            employeeId: employee._id,
            status: { $ne: 'Inactive' },
            entryDate: { $gte: todayStart, $lt: tomorrowStart }
        }).select('recordType expenseType amount').lean(),
        Employee.find({ status: 'Active' })
            .select('_id employeeName photoUrl role')
            .lean()
    ]);

    const salaryMode = employee.salaryMode || 'percentage';
    const salaryPercentage = Number(employee.salaryPercentage ?? 50);
    const fixedMonthlySalary = Number(employee.fixedMonthlySalary || 0);
    const dailyEarning = amount => salaryMode === 'fixed'
        ? fixedMonthlySalary / 30
        : Number(amount || 0) * salaryPercentage / 100;
    const collectionsByDay = new Map();
    for (const entry of recentCollections) {
        const key = new Date(entry.entryDate).toISOString().slice(0, 10);
        collectionsByDay.set(key, (collectionsByDay.get(key) || 0) + Number(entry.amount || 0));
    }
    const sparkline = [];
    for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(sparklineStart);
        date.setUTCDate(date.getUTCDate() + offset);
        sparkline.push(dailyEarning(collectionsByDay.get(date.toISOString().slice(0, 10)) || 0));
    }
    const todayCollection = collectionsByDay.get(todayKey) || 0;
    const yesterdayCollection = collectionsByDay.get(yesterdayStart.toISOString().slice(0, 10)) || 0;
    const todayAdvance = todayRecords
        .filter(record => record.recordType === 'expense' && /advance/i.test(String(record.expenseType || '')))
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const todaySalaryPaid = todayRecords
        .filter(record => record.recordType === 'salary')
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const todaySummary = {
        date: todayKey,
        todayCollection,
        yesterdayCollection,
        todayAdvance,
        todaySalaryPaid,
        todayEarned: dailyEarning(todayCollection),
        sparkline
    };

    const collectionTotal = collections.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const earnedSalary = salaryMode === 'fixed'
        ? fixedMonthlySalary
        : collectionTotal * salaryPercentage / 100;
    const expenses = records.filter(record => record.recordType === 'expense')
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const advanceTaken = records
        .filter(record => record.recordType === 'expense' && /advance/i.test(String(record.expenseType || '')))
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const salaryPaid = records.filter(record => record.recordType === 'salary')
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const taken = advanceTaken + salaryPaid;
    const monthSummary = {
        collection: collectionTotal,
        earnedSalary,
        expenses,
        advanceTaken,
        salaryPaid,
        taken,
        payable: Math.max(0, earnedSalary - expenses - salaryPaid),
        balance: Math.max(0, earnedSalary - taken),
        extra: Math.max(0, taken - earnedSalary),
        percent: earnedSalary > 0 ? Math.floor(taken / earnedSalary * 100) : taken > 0 ? 100 : 0,
        salaryMode,
        salaryPercentage,
        fixedMonthlySalary
    };

    const activeStarEmployees = activeEmployees.filter(item => !isAdmin(item));
    const activeStarIds = activeStarEmployees.map(item => item._id);
    let starOfTheMonth = null;
    if (activeStarIds.length) {
        const [topCollection] = await CollectionEntry.aggregate([
            {
                $match: {
                    status: { $ne: 'Inactive' },
                    entryDate: { $gte: start, $lt: end },
                    staffId: { $in: activeStarIds },
                    amount: { $gt: 0 }
                }
            },
            { $group: { _id: '$staffId', totalWork: { $sum: '$amount' } } },
            { $sort: { totalWork: -1, _id: 1 } },
            { $limit: 1 }
        ]);
        if (topCollection) {
            const topEmployee = activeStarEmployees.find(
                item => String(item._id) === String(topCollection._id)
            );
            if (topEmployee) {
                starOfTheMonth = {
                    employeeId: String(topEmployee._id),
                    employeeName: topEmployee.employeeName || 'Employee',
                    photoUrl: topEmployee.photoUrl || '',
                    collection: Number(topCollection.totalWork || 0),
                    isCurrentUser: String(topEmployee._id) === String(employee._id)
                };
            }
        }
    }

    return {
        month,
        employee: employeeProfileDetails(employee),
        collections,
        records,
        todaySummary,
        monthSummary,
        starOfTheMonth,
        summary: monthSummary
    };
}

app.get('/api/my-profile', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!req.employee?._id || isAdmin(req.employee)) {
            return res.status(403).json({ error: 'Profile is only available to employee accounts.' });
        }
        return res.json({ employee: employeeProfileDetails(req.employee) });
    } catch (error) {
        console.error('Employee profile error:', error);
        return res.status(500).json({ error: 'Could not load your profile.' });
    }
});

app.get('/api/my-data', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!req.employee?._id || isAdmin(req.employee)) {
            return res.status(403).json({ error: 'Employee dashboard is only available to employee accounts.' });
        }
        const month = String(req.query.month || getTodayDate().slice(0, 7));
        return res.json(await employeeDashboardData(req.employee, month));
    } catch (error) {
        console.error('Employee dashboard data error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Could not load your dashboard data.' });
    }
});

app.get('/api/employee-dashboard/:employeeId', requireSecureAuth, verifyEmployee, requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.employeeId)) {
            return res.status(400).json({ error: 'Select a valid employee.' });
        }
        const employee = await Employee.findById(req.params.employeeId).lean();
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });
        if (isAdmin(employee)) {
            return res.status(400).json({ error: 'Choose an employee account to view this dashboard.' });
        }
        const month = String(req.query.month || getTodayDate().slice(0, 7));
        return res.json(await employeeDashboardData(employee, month));
    } catch (error) {
        console.error('Admin employee dashboard data error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Could not load the employee dashboard.' });
    }
});

const moduleDefinitions = {
    collection: { label: 'Collection', permission: 'Customer Entry', recordType: 'collections' },
    expense: { label: 'Expense', permission: 'Daily Expense', recordType: 'expense' },
    salary: { label: 'Salary', permission: 'Salary', recordType: 'salary' },
    counter: { label: 'Cash At Counter', permission: 'Cash At Counter', recordType: 'counter' }
};

function parseDateStart(value) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date;
}

function nextDate(date) {
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function reportRange(query = {}) {
    const suppliedFrom = parseDateStart(query.from);
    const suppliedTo = parseDateStart(query.to);
    if (suppliedFrom && suppliedTo) {
        const end = nextDate(suppliedTo);
        if (end <= suppliedFrom) throw new Error('Report end date must be on or after the start date.');
        return { start: suppliedFrom, end, from: query.from, to: query.to };
    }

    const anchor = parseDateStart(query.date) || parseDateStart(getTodayDate());
    const period = ['daily', 'weekly', 'monthly'].includes(String(query.period))
        ? String(query.period)
        : 'monthly';
    let start;
    let end;
    if (period === 'daily') {
        start = anchor;
        end = nextDate(start);
    } else if (period === 'weekly') {
        start = new Date(anchor);
        const day = start.getUTCDay();
        start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
        start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
        end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    }
    return {
        start,
        end,
        from: start.toISOString().slice(0, 10),
        to: new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    };
}

async function loadReportData(range, employeeId = '') {
    const collectionFilter = { entryDate: { $gte: range.start, $lt: range.end } };
    const recordFilter = { entryDate: { $gte: range.start, $lt: range.end } };
    applyStatusFilter(collectionFilter, 'Active');
    applyStatusFilter(recordFilter, 'Active');
    if (employeeId) {
        collectionFilter.staffId = employeeId;
        recordFilter.employeeId = employeeId;
    }
    const [collections, records] = await Promise.all([
        CollectionEntry.find(collectionFilter).sort({ entryDate: 1, createdAt: 1 }).lean(),
        EmployeeRecord.find(recordFilter).sort({ entryDate: 1, createdAt: 1 }).lean()
    ]);
    const rows = [
        ...collections.map(entry => ({
            id: String(entry._id),
            date: entry.entryDate,
            type: 'Collection',
            employeeName: entry.staff,
            detail: entry.serviceType,
            amount: entry.amount,
            paymentMode: entry.paymentMode,
            createdBy: entry.createdBy || ''
        })),
        ...records.map(record => ({
            id: String(record._id),
            date: record.entryDate,
            type: record.recordType === 'expense'
                ? 'Expense'
                : record.recordType === 'salary' ? 'Salary' : 'Cash At Counter',
            employeeName: record.employeeName,
            detail: record.expenseType || record.salaryMonth || record.remark || '',
            amount: record.amount,
            paymentMode: record.paymentMode,
            createdBy: record.createdBy || ''
        }))
    ].sort((left, right) => new Date(left.date) - new Date(right.date));
    const summary = rows.reduce((result, row) => {
        const key = row.type === 'Collection' ? 'collection'
            : row.type === 'Expense' ? 'expense'
                : row.type === 'Salary' ? 'salary' : 'counter';
        result[key] += Number(row.amount || 0);
        return result;
    }, { collection: 0, expense: 0, salary: 0, counter: 0 });
    summary.net = summary.collection - summary.expense - summary.salary;
    return { from: range.from, to: range.to, rows, summary };
}

function pdfText(value) {
    return String(value ?? '')
        .replace(/[^\x20-\x7E]/g, '?')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .slice(0, 180);
}

function makeSimplePdf(lines) {
    const chunks = [];
    for (let index = 0; index < lines.length; index += 48) chunks.push(lines.slice(index, index + 48));
    if (!chunks.length) chunks.push(['No report data.']);
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    const pageReferences = [];
    for (const chunk of chunks) {
        const content = [
            'BT',
            '/F1 9 Tf',
            '50 760 Td',
            ...chunk.flatMap(line => [`(${pdfText(line)}) Tj`, '0 -15 Td']),
            'ET'
        ].join('\n');
        const pageObject = objects.length + 1;
        const contentObject = objects.length + 2;
        pageReferences.push(pageObject);
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`,
            `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`
        );
    }
    objects[1] = `<< /Type /Pages /Kids [${pageReferences.map(reference => `${reference} 0 R`).join(' ')}] /Count ${pageReferences.length} >>`;
    let output = '%PDF-1.4\n';
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(output, 'ascii'));
        output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(output, 'ascii');
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index < offsets.length; index += 1) {
        output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(output, 'ascii');
}

app.get('/api/module-records', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        const moduleKey = String(req.query.module || '').trim();
        const definition = moduleDefinitions[moduleKey];
        if (!definition) return res.status(400).json({ error: 'Select a valid data module.' });
        if (!await hasActionAccess(req.employee, moduleKey, 'view')) {
            return res.status(403).json({ error: `You do not have ${definition.permission} access.` });
        }
        const requestedPage = Number.parseInt(req.query.page, 10);
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Math.min(100, Math.max(1, Number.isSafeInteger(requestedLimit) ? requestedLimit : 10));
        const filter = {};
        applyStatusFilter(filter, req.query.status);
        if (moduleKey === 'collection') {
            Object.assign(filter, isAdmin(req.employee)
                ? {}
                : await employeeCollectionFilter(req.employee));
            if (isAdmin(req.employee) && req.query.employeeId) {
                if (!mongoose.isValidObjectId(req.query.employeeId)) return res.status(400).json({ error: 'Invalid employee filter.' });
                filter.staffId = req.query.employeeId;
            }
        } else {
            filter.recordType = moduleKey;
            if (isAdmin(req.employee) && req.query.employeeId) {
                if (!mongoose.isValidObjectId(req.query.employeeId)) return res.status(400).json({ error: 'Invalid employee filter.' });
                filter.employeeId = req.query.employeeId;
            } else if (!isAdmin(req.employee)) {
                filter.employeeId = req.employee._id;
            }
        }
        if (req.query.id) {
            if (!mongoose.isValidObjectId(req.query.id)) return res.status(400).json({ error: 'Invalid record ID.' });
            filter._id = req.query.id;
        }
        const from = parseDateStart(req.query.from);
        const to = parseDateStart(req.query.to);
        if (from || to) {
            if (!from || !to || to < from) return res.status(400).json({ error: 'Select a valid date range.' });
            filter.entryDate = { $gte: from, $lt: nextDate(to) };
        }
        const total = moduleKey === 'collection'
            ? await CollectionEntry.countDocuments(filter)
            : await EmployeeRecord.countDocuments(filter);
        const page = Math.min(
            Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1,
            Math.max(1, Math.ceil(total / limit))
        );
        const query = moduleKey === 'collection'
            ? CollectionEntry.find(filter).select('entryNo entryDate staff staffId serviceType items amount costCutting paymentMode remark createdBy createdAt status inactiveAction inactiveAt inactiveBy')
            : EmployeeRecord.find(filter);
        const records = await query.sort({ entryDate: -1, createdAt: -1, _id: -1 })
            .skip((page - 1) * limit).limit(limit).lean();
        return res.json({ module: moduleKey, label: definition.label, records, page, limit, total });
    } catch (error) {
        console.error('Module table read error:', error);
        return res.status(500).json({ error: 'Could not load module records.' });
    }
});

app.get('/api/my-work', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!await hasActionAccess(req.employee, 'collection', 'view')) {
            return res.status(403).json({ error: 'You do not have Collection view access.' });
        }
        const requestedPage = Number.parseInt(req.query.page, 10);
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Math.min(100, Math.max(1, Number.isSafeInteger(requestedLimit) ? requestedLimit : 20));
        const filter = isAdmin(req.employee)
            ? {}
            : await employeeCollectionFilter(req.employee);
        if (isAdmin(req.employee) && req.query.employeeId) {
            if (!mongoose.isValidObjectId(req.query.employeeId)) {
                return res.status(400).json({ error: 'Invalid employee filter.' });
            }
            filter.staffId = req.query.employeeId;
        }
        applyStatusFilter(filter, req.query.status);
        const from = parseDateStart(req.query.from);
        const to = parseDateStart(req.query.to);
        if (from || to) {
            if (!from || !to || to < from) {
                return res.status(400).json({ error: 'Select a valid date range.' });
            }
            filter.entryDate = { $gte: from, $lt: nextDate(to) };
        }
        const total = await CollectionEntry.countDocuments(filter);
        const page = Math.min(
            Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1,
            Math.max(1, Math.ceil(total / limit))
        );
        const [records, dateGroups] = await Promise.all([
            CollectionEntry.find(filter)
                .select('entryNo entryDate staff staffId serviceType items amount costCutting paymentMode remark createdBy createdAt status inactiveAction inactiveAt inactiveBy')
                .sort({ entryDate: -1, entryNo: -1, createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            CollectionEntry.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$entryDate' } },
                        count: { $sum: 1 },
                        total: { $sum: '$amount' }
                    }
                },
                { $sort: { _id: -1 } }
            ])
        ]);
        return res.json({
            records,
            page,
            limit,
            total,
            dateGroups: dateGroups.map(group => ({
                date: group._id,
                count: Number(group.count || 0),
                total: Number(group.total || 0)
            }))
        });
    } catch (error) {
        console.error('My work read error:', error);
        return res.status(500).json({ error: 'Could not load your work entries.' });
    }
});

app.get('/api/reports', requireSecureAuth, verifyEmployee, requireAnyPageAccess('reports'), async (req, res) => {
    try {
        const range = reportRange(req.query);
        let employeeId = '';
        if (req.query.employeeId) {
            if (!mongoose.isValidObjectId(req.query.employeeId)) return res.status(400).json({ error: 'Invalid employee filter.' });
            employeeId = String(req.query.employeeId);
        }
        return res.json(await loadReportData(range, employeeId));
    } catch (error) {
        return res.status(400).json({ error: error.message || 'Could not load report data.' });
    }
});

app.get('/api/reports/export', requireSecureAuth, verifyEmployee, requireAnyPageAccess('reports'), requireActionPermission('reports', 'export'), async (req, res) => {
    try {
        const format = String(req.query.format || '').toLowerCase();
        if (!['xlsx', 'pdf'].includes(format)) return res.status(400).json({ error: 'Choose Excel or PDF format.' });
        const range = reportRange(req.query);
        const employeeId = req.query.employeeId && mongoose.isValidObjectId(req.query.employeeId)
            ? String(req.query.employeeId) : '';
        const report = await loadReportData(range, employeeId);
        await recordAudit(req, {
            action: 'EXPORT', page: 'Reports', module: 'Reports',
            metadata: { format, from: report.from, to: report.to }
        });
        const dateLabel = `${report.from}-to-${report.to}`;
        if (format === 'pdf') {
            const lines = [
                'YOURS SALON REPORT',
                `Period: ${report.from} to ${report.to}`,
                `Collection: INR ${report.summary.collection.toFixed(2)}`,
                `Expense: INR ${report.summary.expense.toFixed(2)}`,
                `Salary: INR ${report.summary.salary.toFixed(2)}`,
                `Cash At Counter: INR ${report.summary.counter.toFixed(2)}`,
                `Net: INR ${report.summary.net.toFixed(2)}`,
                '',
                'Date | Type | Employee | Details | Amount'
            ];
            for (const row of report.rows) {
                lines.push(`${new Date(row.date).toISOString().slice(0, 10)} | ${row.type} | ${row.employeeName} | ${row.detail} | INR ${Number(row.amount || 0).toFixed(2)}`);
            }
            const buffer = makeSimplePdf(lines);
            res.type('application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="yours-salon-report-${dateLabel}.pdf"`);
            return res.send(buffer);
        }
        const headers = ['Date', 'Type', 'Employee', 'Details', 'Amount', 'Payment Mode', 'Created By'];
        const rows = report.rows.map(row => [row.date, row.type, row.employeeName, row.detail, row.amount, row.paymentMode, row.createdBy]);
        const workbook = await writeXlsxFile([headers, ...rows], { sheet: 'Report', dateFormat: 'yyyy-mm-dd hh:mm:ss' });
        const buffer = await workbook.toBuffer();
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="yours-salon-report-${dateLabel}.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        return res.status(400).json({ error: error.message || 'Could not export report.' });
    }
});

app.get('/api/activity-logs', requireSecureAuth, verifyEmployee, requireAnyPageAccess('activity-report', 'reports'), async (req, res) => {
    try {
        const now = Date.now();
        const minimum = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const requestedFrom = parseDateStart(req.query.from);
        const requestedTo = parseDateStart(req.query.to);
        const start = requestedFrom && requestedFrom > minimum ? requestedFrom : minimum;
        const end = requestedTo ? nextDate(requestedTo) : new Date(now + 1000);
        const filter = { createdAt: { $gte: start, $lte: end } };
        if (req.query.action) filter.action = String(req.query.action).slice(0, 60);
        if (req.query.pageName) filter.page = String(req.query.pageName).slice(0, 150);
        if (req.query.actor) {
            filter.$or = [
                { actorName: { $regex: String(req.query.actor).slice(0, 80), $options: 'i' } },
                { actorUserId: { $regex: String(req.query.actor).slice(0, 80), $options: 'i' } }
            ];
        }
        const requestedPage = Number.parseInt(req.query.page, 10);
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Math.min(100, Math.max(1, Number.isSafeInteger(requestedLimit) ? requestedLimit : 25));
        const total = await AuditLog.countDocuments(filter);
        const page = Math.min(Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1, Math.max(1, Math.ceil(total / limit)));
        const logs = await AuditLog.find(filter).sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit).limit(limit).lean();
        return res.json({ logs, page, limit, total, from: start, to: end });
    } catch (error) {
        console.error('Activity log read error:', error);
        return res.status(500).json({ error: 'Could not load activity logs.' });
    }
});

app.get('/api/admin-data', requireSecureAuth, verifyEmployee, requireAdmin, async (req, res) => {
    try {
        const dataset = String(req.query.dataset || 'collections');
        const datasets = ['collections', 'expense', 'salary', 'counter'];
        if (!datasets.includes(dataset)) {
            return res.status(400).json({ error: 'Select a valid admin data section.' });
        }
        const pageInput = Number.parseInt(req.query.page, 10);
        const pageSizeInput = Number.parseInt(req.query.limit, 10);
        const limit = Math.min(100, Math.max(1, Number.isSafeInteger(pageSizeInput) ? pageSizeInput : 100));
        const total = dataset === 'collections'
            ? await CollectionEntry.countDocuments()
            : await EmployeeRecord.countDocuments({ recordType: dataset });
        const page = Math.min(
            Number.isSafeInteger(pageInput) ? Math.max(1, pageInput) : 1,
            Math.max(1, Math.ceil(total / limit))
        );
        const query = dataset === 'collections'
            ? CollectionEntry.find()
                .select('entryNo entryDate staff serviceType items amount costCutting paymentMode remark createdBy createdAt')
            : EmployeeRecord.find({ recordType: dataset });
        const records = await query.sort({ entryDate: -1, createdAt: -1, _id: -1 })
            .skip((page - 1) * limit).limit(limit).lean();
        return res.json({ dataset, records, page, limit, total });
    } catch (error) {
        console.error('Admin data list error:', error);
        return res.status(500).json({ error: 'Could not load admin data.' });
    }
});

app.get('/api/staff', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        const filter = { status: 'Active' };
        const canSeeAll = isAdmin(req.employee) ||
            await hasPageAccess(req.employee, 'reports') ||
            await hasPageAccess(req.employee, 'employee-list');
        if (!canSeeAll) filter._id = req.employee._id;
        const [employees, config] = await Promise.all([
            Employee.find(filter, { employeeId: 1, employeeName: 1 }).sort({ sr: 1, employeeName: 1 }).lean(),
            AppConfig.findOne({ key: 'collection' }).lean()
        ]);
        const employeeIds = employees.map(employee => employee._id);
        const accessRows = config?.allowPreviousEntry && employeeIds.length
            ? await EmployeeDateAccess.find({
                employeeId: { $in: employeeIds },
                expiresAt: { $gt: new Date() }
            }).select('employeeId date').lean()
            : [];
        const datesByEmployee = new Map();
        for (const row of accessRows) {
            const key = String(row.employeeId);
            if (!datesByEmployee.has(key)) datesByEmployee.set(key, []);
            datesByEmployee.get(key).push(row.date);
        }
        return res.json(employees.map(employee => ({
            ...employee,
            allowedEntryDates: config?.allowPreviousEntry
                ? (datesByEmployee.get(String(employee._id)) || []).sort((left, right) => right.localeCompare(left))
                : []
        })));
    } catch (error) {
        console.error('Staff list error:', error);
        return res.status(500).json({ error: 'Could not load active employees.' });
    }
});

app.get('/api/expense-types', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration', 'employee-list'), async (req, res) => {
    try {
        await ensureDefaultExpenseTypes();
        const expenseTypes = await ExpenseType.find().sort({ sr: 1 }).lean();
        return res.json(expenseTypes);
    } catch (error) {
        console.error('Expense type list error:', error);
        return res.status(500).json({ error: 'Could not load expense types.' });
    }
});

app.post('/api/expense-types', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'add'), async (req, res) => {
    try {
        const sr = Number(req.body.sr);
        const name = String(req.body.name ?? '').trim();
        const status = String(req.body.status ?? 'Active').trim();
        if (!Number.isSafeInteger(sr) || sr < 1 || !name || name.length > 100 ||
            !['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ error: 'Enter a valid serial number, expense type name, and status.' });
        }
        const expenseType = await ExpenseType.create({ sr, name, status });
        await recordAudit(req, {
            action: 'CREATE', page: 'Expense Type', module: 'Expense Type', recordType: 'ExpenseType',
            recordId: String(expenseType._id), newValue: expenseType
        });
        return res.status(201).json(expenseType);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'That serial number or expense type name is already in use.' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        console.error('Expense type create error:', error);
        return res.status(500).json({ error: 'Could not create expense type.' });
    }
});

app.put('/api/expense-types/:id', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'edit'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid expense type ID.' });
        }
        const sr = Number(req.body.sr);
        const name = String(req.body.name ?? '').trim();
        const status = String(req.body.status ?? '').trim();
        if (!Number.isSafeInteger(sr) || sr < 1 || !name || name.length > 100 ||
            !['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ error: 'Enter a valid serial number, expense type name, and status.' });
        }
        const previousType = await ExpenseType.findById(req.params.id).lean();
        if (!previousType) return res.status(404).json({ error: 'Expense type not found.' });
        if (previousType.sr !== sr && await Employee.exists({
            $or: [
                { expenseTypeSr: previousType.sr },
                { 'expenseTypes.sr': previousType.sr }
            ]
        })) {
            return res.status(409).json({
                error: 'This serial number is assigned to employees. Keep the SR unchanged or reassign those employees first.'
            });
        }
        const expenseType = await ExpenseType.findByIdAndUpdate(
            req.params.id,
            { $set: { sr, name, status } },
            { returnDocument: 'after', runValidators: true }
        );
        if (previousType.name !== name) {
            await syncExpenseTypeReferences(expenseType, previousType.sr);
        }
        await recordAudit(req, {
            action: 'UPDATE', page: 'Expense Type', module: 'Expense Type', recordType: 'ExpenseType',
            recordId: String(expenseType._id), oldValue: previousType, newValue: expenseType
        });
        return res.json(expenseType);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'That serial number or expense type name is already in use.' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        console.error('Expense type update error:', error);
        return res.status(500).json({ error: 'Could not update expense type.' });
    }
});

app.post(
    '/api/expense-types/import',
    requireSecureAuth,
    verifyEmployee,
    requireAnyPageAccess('configuration'),
    requireActionPermission('configuration', 'add'),
    (req, res, next) => upload.single('file')(req, res, error => {
        if (error) return res.status(400).json({ error: error.message });
        return next();
    }),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'Choose an .xlsx or .csv file to upload.' });
            const extension = path.extname(req.file.originalname).toLowerCase();
            let rows;
            if (extension === '.xlsx') {
                rows = await readSheet(req.file.buffer);
            } else if (extension === '.csv') {
                rows = parseCsv(req.file.buffer.toString('utf8'));
            } else {
                return res.status(400).json({ error: 'Only .xlsx and .csv files are supported.' });
            }
            if (!rows.length) return res.status(400).json({ error: 'The uploaded file is empty.' });

            const headerIndexes = new Map();
            rows[0].forEach((header, index) => headerIndexes.set(normalizeHeader(header), index));
            if (!headerIndexes.has('sr') || !headerIndexes.has('expensetype')) {
                return res.status(400).json({ error: 'The file must include SR and Expense Type columns.' });
            }

            const expenseTypes = [];
            const errors = [];
            for (let index = 1; index < rows.length; index += 1) {
                const row = rows[index];
                if (!row.some(cell => String(cell ?? '').trim())) continue;
                const sr = Number(getCell(row, headerIndexes, ['sr']));
                const name = String(getCell(row, headerIndexes, ['expensetype'])).trim();
                const rawStatus = String(getCell(row, headerIndexes, ['status']) || 'Active').trim().toLowerCase();
                if (!Number.isSafeInteger(sr) || sr < 1 || !name || name.length > 100 ||
                    !['active', 'inactive'].includes(rawStatus)) {
                    errors.push(`Row ${index + 1}: provide a positive SR, Expense Type name, and Active/Inactive status.`);
                    continue;
                }
                expenseTypes.push({
                    sr,
                    name,
                    status: rawStatus === 'inactive' ? 'Inactive' : 'Active'
                });
            }
            if (!expenseTypes.length) {
                return res.status(400).json({
                    error: 'No valid expense type rows found.',
                    rowErrors: errors.slice(0, 25)
                });
            }

            const typesBySr = new Map();
            for (const expenseType of expenseTypes) typesBySr.set(expenseType.sr, expenseType);
            const namesInFile = new Set();
            for (const expenseType of typesBySr.values()) {
                const nameKey = expenseType.name.toLowerCase();
                if (namesInFile.has(nameKey)) {
                    return res.status(400).json({ error: `Duplicate expense type name in file: ${expenseType.name}.` });
                }
                namesInFile.add(nameKey);
            }
            const currentTypes = await ExpenseType.find().lean();
            const finalTypesBySr = new Map(currentTypes.map(expenseType => [expenseType.sr, expenseType]));
            for (const expenseType of typesBySr.values()) {
                finalTypesBySr.set(expenseType.sr, expenseType);
            }
            const finalNames = new Set();
            for (const expenseType of finalTypesBySr.values()) {
                const nameKey = expenseType.name.toLowerCase();
                if (finalNames.has(nameKey)) {
                    return res.status(409).json({
                        error: `Expense type name "${expenseType.name}" is already assigned to another serial number.`
                    });
                }
                finalNames.add(nameKey);
            }
            const operations = [...typesBySr.values()].map(expenseType => ({
                updateOne: {
                    filter: { sr: expenseType.sr },
                    update: { $set: expenseType },
                    upsert: true
                }
            }));
            const result = await ExpenseType.bulkWrite(operations, { ordered: false });
            for (const expenseType of typesBySr.values()) {
                await syncExpenseTypeReferences(expenseType);
            }
            return res.json({
                message: 'Expense types imported.',
                inserted: result.upsertedCount,
                updated: result.matchedCount,
                processed: operations.length,
                invalidRows: errors.length,
                rowErrors: errors.slice(0, 25)
            });
        } catch (error) {
            console.error('Expense type import error:', error);
            return res.status(500).json({ error: 'Could not import the expense type file.' });
        }
    }
);

app.get('/api/rate-list', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), async (req, res) => {
    try {
        const rates = await RateList.find().lean();
        rates.sort(rateListSort);
        return res.json(rates);
    } catch (error) {
        console.error('Rate list read error:', error);
        return res.status(500).json({ error: 'Could not load the rate list.' });
    }
});

app.post('/api/rate-list', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'add'), async (req, res) => {
    try {
        const serviceType = String(req.body.serviceType || '').trim();
        const shortName = String(req.body.shortName || '').trim().slice(0, 60) || serviceType.slice(0, 60);
        const serviceCategory = String(req.body.serviceCategory || '').trim().slice(0, 100);
        const rate = Number(req.body.rate);
        const category = String(req.body.category || 'Main').trim();
        const status = String(req.body.status || 'Active').trim();
        const sr = req.body.sr === undefined || req.body.sr === '' ? 0 : Number(req.body.sr);
        if (!serviceType || serviceType.length > 150 || !Number.isFinite(rate) || rate < 0 || rate > 100000000 ||
            !['Main', 'Other'].includes(category) || !['Active', 'Inactive'].includes(status) ||
            !Number.isSafeInteger(sr) || sr < 0) {
            return res.status(400).json({ error: 'Enter a valid SR No, service type, short name, rate, category, and status.' });
        }
        const item = await RateList.create({
            sr, serviceType, shortName, serviceCategory, rate, category, status,
            createdBy: req.employee?.employeeName || ''
        });
        await recordAudit(req, {
            action: 'CREATE', page: 'Rate List', module: 'Rate List', recordType: 'RateList',
            recordId: String(item._id), newValue: item
        });
        return res.status(201).json(item);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'That service type already exists.' });
        if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
        console.error('Rate list create error:', error);
        return res.status(500).json({ error: 'Could not create the rate list item.' });
    }
});

app.put('/api/rate-list/:id', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'edit'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid rate list item.' });
        const before = await RateList.findById(req.params.id).lean();
        if (!before) return res.status(404).json({ error: 'Rate list item not found.' });
        const serviceType = String(req.body.serviceType || '').trim();
        const shortName = String(req.body.shortName || '').trim().slice(0, 60) || serviceType.slice(0, 60);
        const serviceCategory = String(req.body.serviceCategory !== undefined ? req.body.serviceCategory : (before.serviceCategory || '')).trim().slice(0, 100);
        const rate = Number(req.body.rate);
        const category = String(req.body.category || before.category || 'Main').trim();
        const status = String(req.body.status || '').trim();
        const sr = req.body.sr === undefined || req.body.sr === '' ? Number(before.sr || 0) : Number(req.body.sr);
        if (!serviceType || serviceType.length > 150 || !Number.isFinite(rate) || rate < 0 || rate > 100000000 ||
            !['Main', 'Other'].includes(category) || !['Active', 'Inactive'].includes(status) ||
            !Number.isSafeInteger(sr) || sr < 0) {
            return res.status(400).json({ error: 'Enter a valid SR No, service type, short name, rate, category, and status.' });
        }
        const item = await RateList.findByIdAndUpdate(
            req.params.id,
            { $set: { sr, serviceType, shortName, serviceCategory, rate, category, status } },
            { returnDocument: 'after', runValidators: true }
        ).lean();
        await recordAudit(req, {
            action: 'UPDATE', page: 'Rate List', module: 'Rate List', recordType: 'RateList',
            recordId: String(item._id), oldValue: before, newValue: item
        });
        return res.json(item);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'That service type already exists.' });
        if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
        console.error('Rate list update error:', error);
        return res.status(500).json({ error: 'Could not update the rate list item.' });
    }
});

app.post('/api/collection-custom-services', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        if (!await hasActionAccess(req.employee, 'collection', 'add')) {
            return res.status(403).json({ error: 'You do not have Collection add access.' });
        }
        const serviceType = String(req.body.serviceType || req.body.name || '').trim();
        const rate = Number(req.body.rate);
        if (!serviceType || serviceType.length > 150) {
            return res.status(400).json({ error: 'Enter a valid service name.' });
        }
        if (!Number.isFinite(rate) || rate <= 0 || rate > 100000000) {
            return res.status(400).json({ error: 'Enter a valid service rate.' });
        }
        const existing = await RateList.findOne({
            serviceType: { $regex: `^${escapeRegex(serviceType)}$`, $options: 'i' }
        }).lean();
        if (existing) {
            return res.status(409).json({
                error: 'That service already exists in the Rate List.',
                service: existing
            });
        }
        const last = await RateList.findOne().sort({ sr: -1, createdAt: -1 }).select('sr').lean();
        const sr = Number.isSafeInteger(Number(last?.sr)) ? Number(last.sr) + 1 : 1;
        const item = await RateList.create({
            sr,
            serviceType,
            shortName: serviceType.slice(0, 60),
            serviceCategory: String(req.body.serviceCategory || '').trim().slice(0, 100),
            rate,
            category: 'Other',
            status: 'Active',
            createdBy: req.employee?.employeeName || ''
        });
        await recordAudit(req, {
            action: 'CREATE', page: 'Collection Entry', module: 'Customer Entry', recordType: 'RateList',
            recordId: String(item._id), newValue: item
        });
        return res.status(201).json(item);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'That service already exists in the Rate List.' });
        if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
        console.error('Custom service create error:', error);
        return res.status(500).json({ error: 'Could not add the custom service.' });
    }
});

app.get('/api/collection-entry-meta', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        const canAdd = await hasActionAccess(req.employee, 'collection', 'add');
        const canEdit = await hasActionAccess(req.employee, 'collection', 'edit');
        if (!canAdd && !canEdit) {
            return res.status(403).json({ error: 'You do not have Collection entry access.' });
        }
        const dateText = String(req.query.date || getTodayDate()).trim();
        const entryDate = parseDateStart(dateText);
        if (!entryDate) return res.status(400).json({ error: 'Select a valid entry date.' });
        const today = getTodayDate();
        const todayDate = parseDateStart(today);
        const config = await AppConfig.findOne({ key: 'collection' }).lean();
        const collectionFilter = await employeeCollectionFilter(req.employee);
        const activeCollectionFilter = { ...collectionFilter };
        applyStatusFilter(activeCollectionFilter, 'Active');
        const [lastEntry, services, todayAggregate, accessRows] = await Promise.all([
            CollectionEntry.findOne({ entryDate }).sort({ entryNo: -1 }).select('entryNo').lean(),
            RateList.find({ status: 'Active' }).lean(),
            CollectionEntry.aggregate([
                { $match: { ...activeCollectionFilter, entryDate: todayDate } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            config?.allowPreviousEntry && !isAdmin(req.employee)
                ? EmployeeDateAccess.find({ employeeId: req.employee._id, expiresAt: { $gt: new Date() } })
                    .select('date').lean()
                : []
        ]);
        services.sort(rateListSort);
        const allowedDates = new Set([today]);
        if (config?.allowPreviousEntry) {
            for (const row of accessRows) allowedDates.add(row.date);
        }
        return res.json({
            date: dateText,
            todayDate: today,
            allowPreviousEntry: config?.allowPreviousEntry ?? false,
            allowedDates: [...allowedDates].sort((left, right) => right.localeCompare(left)),
            nextEntryNo: Number(lastEntry?.entryNo || 0) + 1,
            todayTotal: Number(todayAggregate[0]?.total || 0),
            todayCount: Number(todayAggregate[0]?.count || 0),
            services: services.map(item => ({
                _id: String(item._id),
                sr: Number(item.sr || 0),
                serviceType: item.serviceType,
                shortName: item.shortName || item.serviceType,
                serviceCategory: item.serviceCategory || '',
                rate: Number(item.rate || 0),
                category: item.category || 'Main',
                status: item.status || 'Active'
            }))
        });
    } catch (error) {
        console.error('Collection entry meta error:', error);
        return res.status(500).json({ error: 'Could not load the collection entry form.' });
    }
});

app.get('/api/config', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), async (req, res) => {
    try {
        const config = await AppConfig.findOne({ key: 'collection' }).lean();
        const permissionMap = new Map();
        for (const permission of config?.permissions || []) {
            const name = permission.name.trim().toLowerCase() === 'counter cash'
                ? 'Customer Entry'
                : permission.name;
            const existing = permissionMap.get(name) || [];
            permissionMap.set(name, [...new Set([
                ...existing,
                ...permission.employeeIds.map(id => String(id))
            ])]);
        }
        const permissions = [...defaultPermissionCategories];
        for (const permission of config?.permissions || []) {
            const name = permission.name.trim().toLowerCase() === 'counter cash'
                ? 'Customer Entry'
                : permission.name;
            if (!permissions.includes(name)) permissions.push(name);
        }
        return res.json({
            allowPreviousEntry: config?.allowPreviousEntry ?? false,
            shortfallAdjustment: config?.shortfallAdjustment || 'employee',
            todayDate: getTodayDate(),
            permissions: permissions.map(name => ({
                name,
                employeeIds: permissionMap.get(name) || []
            }))
        });
    } catch (error) {
        console.error('Configuration read error:', error);
        return res.status(500).json({ error: 'Could not load app configuration.' });
    }
});

app.put('/api/config', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'edit'), async (req, res) => {
    try {
        const { allowPreviousEntry, permissions, shortfallAdjustment } = req.body;
        if (typeof allowPreviousEntry !== 'boolean' || !Array.isArray(permissions)) {
            return res.status(400).json({
                error: 'Configuration must include the previous-entry setting and employee permissions.'
            });
        }
        if (shortfallAdjustment !== undefined && !['employee', 'costCutting'].includes(shortfallAdjustment)) {
            return res.status(400).json({ error: 'Select a valid shortfall adjustment option.' });
        }

        const normalizedPermissions = [];
        const seenNames = new Set();
        for (const permission of permissions) {
            if (!permission || typeof permission !== 'object' || Array.isArray(permission)) {
                return res.status(400).json({ error: 'Permission configuration is invalid.' });
            }
            let name = typeof permission.name === 'string' ? permission.name.trim() : '';
            if (!name || name.length > 50) {
                return res.status(400).json({ error: 'Permission names must be 1 to 50 characters.' });
            }
            name = name.trim().toLowerCase() === 'counter cash'
                ? 'Customer Entry'
                : defaultPermissionCategories.find(
                category => category.toLowerCase() === name.toLowerCase()
            ) || name;
            const nameKey = name.toLowerCase();
            if (seenNames.has(nameKey)) {
                return res.status(400).json({ error: `Duplicate permission category: ${name}.` });
            }
            if (!Array.isArray(permission.employeeIds)) {
                return res.status(400).json({ error: `Employee selection is invalid for ${name}.` });
            }
            const employeeIds = [...new Set(permission.employeeIds.map(String))];
            if (employeeIds.some(id => !mongoose.isValidObjectId(id))) {
                return res.status(400).json({ error: `Employee selection is invalid for ${name}.` });
            }
            seenNames.add(nameKey);
            normalizedPermissions.push({ name, employeeIds });
        }

        for (const category of defaultPermissionCategories) {
            if (!seenNames.has(category.toLowerCase())) {
                normalizedPermissions.push({ name: category, employeeIds: [] });
            }
        }

        const permissionEmployeeIds = [...new Set(
            normalizedPermissions.flatMap(permission => permission.employeeIds)
        )];
        if (permissionEmployeeIds.length) {
            const existingPermissionEmployees = await Employee.find({
                _id: { $in: permissionEmployeeIds }
            }).select('_id').lean();
            const existingPermissionIds = new Set(
                existingPermissionEmployees.map(employee => String(employee._id))
            );
            for (const permission of normalizedPermissions) {
                permission.employeeIds = permission.employeeIds.filter(
                    employeeId => existingPermissionIds.has(employeeId)
                );
            }
        }

        const previousConfig = await AppConfig.findOne({ key: 'collection' }).lean();
        const config = await AppConfig.findOneAndUpdate(
            { key: 'collection' },
            {
                $set: {
                    allowPreviousEntry,
                    shortfallAdjustment: shortfallAdjustment || previousConfig?.shortfallAdjustment || 'employee',
                    permissions: normalizedPermissions
                }
            },
            { returnDocument: 'after', upsert: true, runValidators: true }
        ).lean();
        await recordAudit(req, {
            action: 'UPDATE', page: 'General Configuration', module: 'Configuration', recordType: 'AppConfig',
            recordId: String(config._id), oldValue: previousConfig, newValue: config
        });
        return res.json({
            allowPreviousEntry: config.allowPreviousEntry,
            shortfallAdjustment: config.shortfallAdjustment || 'employee',
            permissions: config.permissions
        });
    } catch (error) {
        console.error('Configuration update error:', error);
        return res.status(500).json({ error: 'Could not save app configuration.' });
    }
});

app.get('/api/date-access', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), async (req, res) => {
    try {
        const rows = await EmployeeDateAccess.find({
            expiresAt: { $gt: new Date() }
        }).sort({ date: -1, grantedAt: 1 }).lean();
        return res.json(await dateAccessRowsWithEmployees(rows));
    } catch (error) {
        console.error('Date access read error:', error);
        return res.status(500).json({ error: 'Could not load previous-date access.' });
    }
});

app.post('/api/date-access', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'add'), async (req, res) => {
    try {
        const submittedIds = Array.isArray(req.body.employeeIds)
            ? req.body.employeeIds
            : [req.body.employeeId];
        const employeeIds = [...new Set(submittedIds.map(value => String(value || '').trim()).filter(Boolean))];
        const date = parseEntryDate(req.body.date);
        if (!employeeIds.length || employeeIds.some(id => !mongoose.isValidObjectId(id)) || !date) {
            return res.status(400).json({ error: 'Select at least one employee and a valid date.' });
        }
        const today = getTodayDate();
        if (date >= today) {
            return res.status(400).json({ error: 'Select a previous date. Today is already allowed.' });
        }
        const now = new Date();
        const expiresAt = dateAccessExpiry();
        if (!expiresAt || expiresAt <= now) {
            return res.status(400).json({ error: 'Previous-date access can only be granted during the creation day.' });
        }
        const employees = await Employee.find({ _id: { $in: employeeIds }, status: 'Active' })
            .select('_id employeeId employeeName')
            .lean();
        if (employees.length !== employeeIds.length) {
            const activeIds = new Set(employees.map(employee => String(employee._id)));
            return res.status(400).json({
                error: 'Select only active employees.',
                employeeIds: employeeIds.filter(id => !activeIds.has(id))
            });
        }
        const employeesById = new Map(employees.map(employee => [String(employee._id), employee]));
        const rows = [];
        const skipped = [];
        for (const employeeId of employeeIds) {
            const employee = employeesById.get(employeeId);
            const existing = await EmployeeDateAccess.findOne({ employeeId, date }).lean();
            if (existing) {
                if (existing.expiresAt > now) {
                    skipped.push({
                        employeeId,
                        employeeCode: employee.employeeId,
                        employeeName: employee.employeeName,
                        reason: 'Already allowed'
                    });
                    continue;
                }
                await EmployeeDateAccess.deleteOne({ _id: existing._id });
            }
            try {
                const row = await EmployeeDateAccess.create({
                    employeeId,
                    date,
                    grantedAt: now,
                    grantedBy: req.employee?.employeeName || 'Admin',
                    expiresAt
                });
                rows.push(row.toObject());
            } catch (error) {
                if (error.code !== 11000) throw error;
                skipped.push({
                    employeeId,
                    employeeCode: employee.employeeId,
                    employeeName: employee.employeeName,
                    reason: 'Already allowed'
                });
            }
        }
        const serialized = await dateAccessRowsWithEmployees(rows);
        if (serialized.length) {
            await recordAudit(req, {
                action: 'CREATE', page: 'General Configuration', module: 'Configuration',
                recordType: 'EmployeeDateAccess',
                recordId: serialized.length === 1 ? serialized[0]._id : `${serialized.length} employees`,
                newValue: { date, expiresAt, rows: serialized, skipped }
            });
        }
        return res.status(serialized.length ? 201 : 200).json({
            message: `${serialized.length} date-access row(s) saved.`,
            saved: serialized.length,
            skipped,
            rows: serialized
        });
    } catch (error) {
        console.error('Date access create error:', error);
        return res.status(500).json({ error: 'Could not save previous-date access.' });
    }
});

app.delete('/api/date-access/:id', requireSecureAuth, verifyEmployee, requireAnyPageAccess('configuration'), requireActionPermission('configuration', 'delete'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid date-access row.' });
        }
        const before = await EmployeeDateAccess.findById(req.params.id).lean();
        if (!before) return res.status(404).json({ error: 'Date-access row not found.' });
        await EmployeeDateAccess.deleteOne({ _id: before._id });
        const [serialized] = await dateAccessRowsWithEmployees([before]);
        await recordAudit(req, {
            action: 'DELETE', page: 'General Configuration', module: 'Configuration',
            recordType: 'EmployeeDateAccess', recordId: String(before._id), oldValue: serialized || before
        });
        return res.json({ message: 'Previous-date access removed.' });
    } catch (error) {
        console.error('Date access delete error:', error);
        return res.status(500).json({ error: 'Could not remove previous-date access.' });
    }
});

app.get('/api/import-rules', requireSecureAuth, verifyEmployee, requireAnyPageAccess('import-validation'), async (req, res) => {
    try {
        const rules = await Promise.all(importDatasetDefinitions.map(async definition => {
            const stored = await ImportRule.findOneAndUpdate(
                { dataset: definition.key },
                { $setOnInsert: { dataset: definition.key, ...definition.defaults } },
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            ).lean();
            return {
                dataset: definition.key,
                label: definition.label,
                columns: definition.columns,
                rule: { ...definition.defaults, ...(stored || {}) }
            };
        }));
        return res.json({ datasets: rules });
    } catch (error) {
        console.error('Import rule read error:', error);
        return res.status(500).json({ error: 'Could not load import validation settings.' });
    }
});

app.put('/api/import-rules/:dataset', requireSecureAuth, verifyEmployee, requireAnyPageAccess('import-validation'), requireActionPermission('configuration', 'edit'), async (req, res) => {
    try {
        const definition = importDatasetDefinitions.find(item => item.key === req.params.dataset);
        if (!definition) return res.status(404).json({ error: 'Import dataset not found.' });
        const allowedColumns = new Set(definition.columns);
        const requiredColumns = Array.isArray(req.body.requiredColumns)
            ? [...new Set(req.body.requiredColumns.map(String).filter(column => allowedColumns.has(column)))]
            : [];
        const duplicateKeys = Array.isArray(req.body.duplicateKeys)
            ? [...new Set(req.body.duplicateKeys.map(String).filter(column => allowedColumns.has(column)))]
            : [];
        const duplicateAction = req.body.duplicateAction === 'skip' ? 'skip' : 'reject';
        const maxRows = Math.min(1000, Math.max(1, Number(req.body.maxRows) || 1000));
        const masterChecks = Object.fromEntries(['employee', 'expenseType'].map(key => [key, req.body.masterChecks?.[key] === true]));
        const valueRules = Object.fromEntries(['positiveAmount', 'validDate', 'paymentMode', 'email', 'remarkLength', 'futureDate'].map(key => [key, req.body.valueRules?.[key] === true]));
        const rule = await ImportRule.findOneAndUpdate(
            { dataset: definition.key },
            {
                $set: {
                    enabled: req.body.enabled === true,
                    requiredColumns,
                    duplicateKeys,
                    duplicateAction,
                    masterChecks,
                    valueRules,
                    maxRows
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();
        await recordAudit(req, {
            action: 'UPDATE', page: 'Import Validation', module: 'Configuration',
            recordType: 'ImportRule', recordId: definition.key, newValue: rule
        });
        return res.json({ dataset: definition.key, rule });
    } catch (error) {
        console.error('Import rule update error:', error);
        return res.status(500).json({ error: 'Could not save import validation settings.' });
    }
});

app.get('/api/user-access', requireSecureAuth, verifyEmployee, requireAdmin, async (req, res) => {
    try {
        const [config, activeEmployees] = await Promise.all([
            AppConfig.findOne({ key: 'collection' }).lean(),
            Employee.find({ status: 'Active' }).select('employeeId employeeName role status').sort({ employeeName: 1 }).lean()
        ]);
        const employees = activeEmployees.filter(employee => !isAdmin(employee));
        return res.json({
            pages: accessPageDefinitions,
            groups: accessGroupDefinitions,
            actions: accessActionDefinitions,
            employees,
            rules: config?.accessRules || [],
            defaults: Object.fromEntries(employees.map(employee => [
                String(employee._id),
                accessSnapshotFromConfig(config, employee)
            ]))
        });
    } catch (error) {
        console.error('User access read error:', error);
        return res.status(500).json({ error: 'Could not load user access settings.' });
    }
});

app.put('/api/user-access/:employeeId', requireSecureAuth, verifyEmployee, requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.employeeId)) {
            return res.status(400).json({ error: 'Invalid employee ID.' });
        }
        const employee = await Employee.findOne({ _id: req.params.employeeId, status: 'Active' }).lean();
        if (!employee) return res.status(404).json({ error: 'Active employee not found.' });
        if (isAdmin(employee)) {
            return res.status(400).json({ error: 'Administrator accounts always have full access.' });
        }
        const previousConfig = await AppConfig.findOne({ key: 'collection' }).lean();
        if (req.body.reset === true) {
            await AppConfig.updateOne(
                { key: 'collection' },
                { $pull: { accessRules: { employeeId: employee._id } } }
            );
            const config = await AppConfig.findOne({ key: 'collection' }).lean();
            await recordAudit(req, {
                action: 'UPDATE', page: 'User Access', module: 'Access Control', recordType: 'EmployeeAccess',
                recordId: String(employee._id), oldValue: previousConfig?.accessRules || [], newValue: null,
                metadata: { resetToDefaults: true }
            });
            return res.json({
                employeeId: String(employee._id),
                reset: true,
                ...accessSnapshotFromConfig(config, employee),
                rules: config?.accessRules || []
            });
        }
        if (!Array.isArray(req.body.pages) || !Array.isArray(req.body.actions)) {
            return res.status(400).json({ error: 'Page and action access settings are required.' });
        }
        const validPages = new Set([
            ...accessPageDefinitions
                .filter(definition => !definition.adminOnly)
                .map(definition => definition.key),
            ...accessGroupDefinitions.map(group => group.key)
        ]);
        const pages = [...new Set(['dashboard', ...req.body.pages.map(String)])].filter(page => validPages.has(page));
        const validActions = new Map(accessActionDefinitions.map(definition => [definition.key, definition]));
        const actions = [];
        for (const submitted of req.body.actions) {
            const module = String(submitted?.module || '');
            const definition = validActions.get(module);
            if (!definition || definition.adminOnly) continue;
            const actionValues = Object.fromEntries(allAccessActions.map(action => [action, submitted[action] === true]));
            if (definition.combinedDelete) {
                const combined = actionValues.delete || actionValues.deactivate;
                actionValues.delete = combined;
                actionValues.deactivate = combined;
            }
            actions.push({ module, ...actionValues });
        }
        const existingRules = (previousConfig?.accessRules || [])
            .filter(rule => String(rule.employeeId) !== String(employee._id));
        existingRules.push({ employeeId: employee._id, pages, actions });
        const config = await AppConfig.findOneAndUpdate(
            { key: 'collection' },
            { $set: { accessRules: existingRules } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();
        await recordAudit(req, {
            action: 'UPDATE', page: 'User Access', module: 'Access Control', recordType: 'EmployeeAccess',
            recordId: String(employee._id), oldValue: previousConfig?.accessRules || [], newValue: { pages, actions }
        });
        return res.json({ employeeId: String(employee._id), pages, actions, rules: config.accessRules || [] });
    } catch (error) {
        console.error('User access update error:', error);
        return res.status(500).json({ error: 'Could not save user access settings.' });
    }
});

app.post('/api/user-access/:employeeId/reset-password', requireSecureAuth, verifyEmployee, requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.employeeId)) {
            return res.status(400).json({ error: 'Invalid employee ID.' });
        }
        const employee = await Employee.findOne({ _id: req.params.employeeId, status: 'Active' });
        if (!employee) return res.status(404).json({ error: 'Active employee not found.' });
        if (isAdmin(employee)) {
            return res.status(400).json({ error: 'Administrator accounts use the administrator login settings.' });
        }
        employee.passwordHash = await bcrypt.hash('1234', 10);
        employee.mustChangePassword = true;
        await employee.save();
        await recordAudit(req, {
            action: 'PASSWORD_RESET',
            page: 'User Access',
            module: 'Authentication',
            recordType: 'Employee',
            recordId: String(employee._id),
            newValue: { result: 'Temporary password reset; change required at next sign-in.' },
            metadata: { employeeName: employee.employeeName, userId: employee.userId }
        });
        return res.json({ message: 'Password reset. Temporary password is 1234 and must be changed at next sign-in.' });
    } catch (error) {
        console.error('Employee password reset error:', error);
        return res.status(500).json({ error: 'Could not reset the employee password.' });
    }
});

app.get('/api/shop-details', requireSecureAuth, verifyEmployee, requireAnyPageAccess('shop-information'), async (req, res) => {
    try {
        const details = await ShopDetails.findOneAndUpdate(
            { key: 'primary' },
            { $setOnInsert: { settings: defaultShopDetails } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();
        return res.json({ settings: { ...defaultShopDetails, ...details.settings } });
    } catch (error) {
        console.error('Shop details read error:', error);
        return res.status(500).json({ error: 'Could not load shop details.' });
    }
});

app.put('/api/shop-details', requireSecureAuth, verifyEmployee, requireAnyPageAccess('shop-information'), requireActionPermission('configuration', 'edit'), async (req, res) => {
    try {
        const submittedSettings = req.body?.settings;
        if (!submittedSettings || typeof submittedSettings !== 'object' || Array.isArray(submittedSettings)) {
            return res.status(400).json({ error: 'Shop details settings are required.' });
        }
        const settings = {};
        for (const [key, defaultValue] of Object.entries(defaultShopDetails)) {
            const value = String(submittedSettings[key] ?? '').trim();
            if (value.length > 2000) {
                return res.status(400).json({ error: `${key} must be 2000 characters or fewer.` });
            }
            if (/^(Logo URL|Favicon URL|Login Slide \d Image)$/.test(key) && value) {
                let parsed;
                try {
                    parsed = new URL(value);
                } catch {
                    return res.status(400).json({ error: `${key} must be a valid http or https URL.` });
                }
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return res.status(400).json({ error: `${key} must use http or https.` });
                }
            }
            if (/Color( \d+)?$/.test(key) && !/^#[0-9a-f]{6}$/i.test(value)) {
                return res.status(400).json({ error: `${key} must be a six-digit hex color.` });
            }
            if (key.startsWith('Show ') && !['Yes', 'No'].includes(value)) {
                return res.status(400).json({ error: `${key} must be Yes or No.` });
            }
            if (key === 'Login Page Theme' && !['Light', 'Dark', 'Combination'].includes(value)) {
                return res.status(400).json({ error: 'Login Page Theme must be Light, Dark or Combination.' });
            }
            if (key === 'Button Style' && !['Solid', 'Mix'].includes(value)) {
                return res.status(400).json({ error: 'Button Style must be Solid or Mix.' });
            }
            if (/^(Login Logo Width|Login Logo Height|Login Name Font Size)$/.test(key)) {
                const pixels = Number(value);
                const minimum = key === 'Login Name Font Size' ? 16 : 24;
                const maximum = key === 'Login Name Font Size' ? 72 : 200;
                if (!Number.isSafeInteger(pixels) || pixels < minimum || pixels > maximum) {
                    return res.status(400).json({ error: `${key} must be between ${minimum} and ${maximum} pixels.` });
                }
                settings[key] = String(pixels);
                continue;
            }
            if (key === 'Login Slide Duration') {
                const duration = Number(value);
                if (!Number.isSafeInteger(duration) || duration < 1000 || duration > 60000) {
                    return res.status(400).json({ error: 'Login Slide Duration must be between 1000 and 60000 milliseconds.' });
                }
                settings[key] = String(duration);
                continue;
            }
            settings[key] = value || String(defaultValue);
        }
        const previousDetails = await ShopDetails.findOne({ key: 'primary' }).lean();
        const details = await ShopDetails.findOneAndUpdate(
            { key: 'primary' },
            { $set: { settings } },
            { upsert: true, returnDocument: 'after', runValidators: true }
        ).lean();
        await recordAudit(req, {
            action: 'UPDATE', page: 'Shop Information', module: 'Shop Setup', recordType: 'ShopDetails',
            recordId: String(details._id), oldValue: previousDetails?.settings || null, newValue: details.settings
        });
        return res.json({ message: 'Shop details saved.', settings: details.settings });
    } catch (error) {
        console.error('Shop details update error:', error);
        return res.status(500).json({ error: 'Could not save shop details.' });
    }
});

app.get('/api/employees', requireSecureAuth, verifyEmployee, requireAnyPageAccess('employee-list', 'configuration', 'reports'), async (req, res) => {
    try {
        const employeeFilter = {};
        applyStatusFilter(employeeFilter, req.query.status || 'Active');
        const [employees, catalog] = await Promise.all([
            Employee.find(employeeFilter).sort({ sr: 1, employeeName: 1 }).lean(),
            ExpenseType.find().lean()
        ]);
        return res.json(employees.map(employee => {
            const expenseTypes = getEmployeeExpenseTypes(employee, catalog);
            return {
                ...employee,
                expenseTypes,
                expenseType: expenseTypes.map(item => item.name).join(', ')
            };
        }));
    } catch (error) {
        console.error('Employee list error:', error);
        return res.status(500).json({ error: 'Could not load employees.' });
    }
});

app.get('/api/employee-fields', requireSecureAuth, verifyEmployee, requireAnyPageAccess('employee-list', 'configuration', 'reports'), async (req, res) => {
    try {
        const fields = (await EmployeeField.find().sort({ createdAt: 1, _id: 1 }).lean())
            .filter(field => !isRedundantMobileField(field));
        return res.json(fields);
    } catch (error) {
        console.error('Employee field list error:', error);
        return res.status(500).json({ error: 'Could not load employee custom fields.' });
    }
});

app.post('/api/employee-fields', requireSecureAuth, verifyEmployee, requireAnyPageAccess('employee-list'), requireActionPermission('employees', 'add'), async (req, res) => {
    try {
        const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';
        if (!label || label.length > 50) {
            return res.status(400).json({ error: 'Enter a field name of 1 to 50 characters.' });
        }
        const existingFields = await EmployeeField.find().lean();
        const reservedFieldNames = [
            'SR', 'Employee ID', 'Email address', 'Employee Name', 'Status',
            'Mobile No.', 'Mobile Number', 'Expense Type', 'Expense Types', 'User ID', 'Role',
            'Salary Mode', 'Salary Percentage', 'Fixed Monthly Salary', 'Photo URL', 'Photo',
            'Joining Date', 'Date of Birth', 'PAN No.', 'PAN Number', 'Aadhaar Card No.',
            'Aadhaar Card Number', 'Address', 'City', 'State', 'Pin', 'Pin Code',
            'Alternate Mobile No.', 'Alternate Mobile Number'
        ];
        if (reservedFieldNames.some(name => normalizeHeader(name) === normalizeHeader(label)) ||
            existingFields.some(field => normalizeHeader(field.label) === normalizeHeader(label))) {
            return res.status(409).json({ error: 'A field with that name already exists.' });
        }
        const field = await EmployeeField.create({
            key: `custom_${new mongoose.Types.ObjectId().toString()}`,
            label
        });
        return res.status(201).json(field);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'A field with that name already exists.' });
        }
        console.error('Employee field create error:', error);
        return res.status(500).json({ error: 'Could not add employee custom field.' });
    }
});

app.get('/api/data-port/:dataset/export', requireSecureAuth, verifyEmployee, requireAnyPageAccess('bulk-entry'), async (req, res) => {
    try {
        const { dataset } = req.params;
        const format = String(req.query.format || 'xlsx').toLowerCase();
        if (!['employees', 'customer-entry', 'expense-types', 'expense', 'salary', 'counter'].includes(dataset)) {
            return res.status(400).json({ error: 'Select a supported export dataset.' });
        }
        if (!['csv', 'xlsx'].includes(format)) {
            return res.status(400).json({ error: 'Choose CSV or Excel format.' });
        }

        let headers;
        let records;
        if (dataset === 'employees') {
            const [fieldDefinitions, employees, expenseCatalog] = await Promise.all([
                EmployeeField.find().sort({ createdAt: 1, _id: 1 }).lean(),
                Employee.find().sort({ sr: 1, employeeName: 1 }).lean(),
                ExpenseType.find().lean()
            ]);
            const visibleFieldDefinitions = fieldDefinitions.filter(field => !isRedundantMobileField(field));
            headers = [
                'SR', 'Employee ID', 'Email address', 'Mobile Number', 'Employee Name', 'Status',
                'Joining Date', 'Date of Birth', 'PAN No.', 'Aadhaar Card No.', 'Address', 'City',
                'State', 'Pin', 'Alternate Mobile No.',
                'Expense Types', 'User ID', 'Role', 'Salary Mode', 'Salary Percentage',
                'Fixed Monthly Salary', 'Photo URL',
                ...visibleFieldDefinitions.map(field => field.label)
            ];
            records = employees.map(employee => {
                const expenseTypes = getEmployeeExpenseTypes(employee, expenseCatalog);
                return [
                    employee.sr, employee.employeeId, employee.emailAddress, employee.mobileNumber, employee.employeeName,
                    employee.status, employee.joiningDate, employee.dateOfBirth, employee.panNumber,
                    employee.aadhaarCardNumber, employee.address, employee.city, employee.state, employee.pinCode,
                    employee.alternateMobileNumber, expenseTypes.map(item => item.name).join('; '),
                    employee.userId, employee.role, employee.salaryMode,
                    employee.salaryPercentage, employee.fixedMonthlySalary, employee.photoUrl,
                    ...visibleFieldDefinitions.map(field => employee.customFields?.[field.key] || '')
                ];
            });
        } else if (dataset === 'expense-types') {
            const expenseTypes = await ExpenseType.find().sort({ sr: 1 }).lean();
            headers = ['SR', 'Expense Type', 'Status'];
            records = expenseTypes.map(expenseType => [expenseType.sr, expenseType.name, expenseType.status]);
        } else if (['expense', 'salary', 'counter'].includes(dataset)) {
            const recordsToExport = await EmployeeRecord.find({ recordType: dataset })
                .sort({ entryDate: 1, createdAt: 1 }).lean();
            headers = ['_id', 'Employee Name', 'Entry Date', 'Expense Type SR', 'Expense Type', 'Salary Month', 'Amount', 'Payment Mode', 'Remark', 'Created By', 'Created At'];
            records = recordsToExport.map(record => [
                String(record._id), record.employeeName, record.entryDate, record.expenseTypeSr || '',
                record.expenseType || '', record.salaryMonth || '', record.amount, record.paymentMode,
                record.remark, record.createdBy, record.createdAt
            ]);
        } else {
            const entries = await CollectionEntry.find().sort({ entryDate: 1, createdAt: 1 }).lean();
            headers = ['_id', 'Entry No', 'Entry Date', 'Staff', 'Service Type', 'Amount', 'Cost Cutting', 'Payment Mode', 'Remark', 'Email', 'Created At'];
            records = entries.map(entry => [
                String(entry._id), entry.entryNo, entry.entryDate, entry.staff,
                entry.serviceType, entry.amount, entry.costCutting, entry.paymentMode,
                entry.remark, entry.email, entry.createdAt
            ]);
        }

        await recordAudit(req, {
            action: 'EXPORT', page: 'Bulk Entry', module: 'Bulk Entry',
            metadata: { dataset, format, count: records.length }
        });
        const filename = `yours-salon-${dataset}-${getTodayDate()}.${format}`;
        if (format === 'csv') {
            const csv = toCsv([headers, ...records]);
            res.type('text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(csv);
        }
        const workbook = await writeXlsxFile(
            [headers, ...records],
            {
                sheet: dataset === 'customer-entry' ? 'Customer Entry' : dataset,
                dateFormat: 'yyyy-mm-dd hh:mm:ss'
            }
        );
        const buffer = await workbook.toBuffer();
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(buffer);
    } catch (error) {
        console.error('Data export error:', error);
        return res.status(500).json({ error: 'Could not export the selected data.' });
    }
});

app.get('/api/data-port/:dataset/template', requireSecureAuth, verifyEmployee, requireAnyPageAccess('bulk-entry'), async (req, res) => {
    try {
        const { dataset } = req.params;
        const format = String(req.query.format || 'csv').toLowerCase();
        if (!['employees', 'customer-entry', 'expense', 'salary', 'counter'].includes(dataset)) {
            return res.status(400).json({ error: 'Select a supported template.' });
        }
        if (!['csv', 'xlsx'].includes(format)) {
            return res.status(400).json({ error: 'Choose CSV or Excel format.' });
        }
        let headers;
        if (dataset === 'employees') {
            const fieldDefinitions = (await EmployeeField.find().sort({ createdAt: 1, _id: 1 }).lean())
                .filter(field => !isRedundantMobileField(field));
            headers = [
                'SR', 'Employee ID', 'Email address', 'Mobile Number', 'Employee Name', 'Status',
                'Joining Date', 'Date of Birth', 'PAN No.', 'Aadhaar Card No.', 'Address', 'City',
                'State', 'Pin', 'Alternate Mobile No.', 'Expense Types', 'User ID', 'Role',
                'Salary Mode', 'Salary Percentage', 'Fixed Monthly Salary', 'Photo URL',
                ...fieldDefinitions.map(field => field.label)
            ];
        } else if (dataset === 'customer-entry') {
            headers = ['Entry No', 'Entry Date', 'Staff', 'Service Type', 'Amount', 'Cost Cutting', 'Payment Mode', 'Remark', 'Email'];
        } else if (dataset === 'expense') {
            headers = ['Employee ID', 'Entry Date', 'Expense Type SR', 'Amount', 'Payment Mode', 'Remark'];
        } else if (dataset === 'salary') {
            headers = ['Employee ID', 'Entry Date', 'Salary Month', 'Amount', 'Payment Mode', 'Remark'];
        } else {
            headers = ['Employee ID', 'Entry Date', 'Amount', 'Remark'];
        }
        await recordAudit(req, {
            action: 'EXPORT', page: 'Bulk Entry', module: 'Bulk Entry',
            metadata: { dataset, format, template: true }
        });
        const filename = `yours-salon-${dataset}-template.${format}`;
        if (format === 'csv') {
            res.type('text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(toCsv([headers]));
        }
        const workbook = await writeXlsxFile([headers], { sheet: dataset === 'customer-entry' ? 'Customer Entry' : dataset });
        const buffer = await workbook.toBuffer();
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(buffer);
    } catch (error) {
        console.error('Data template error:', error);
        return res.status(500).json({ error: 'Could not create the template.' });
    }
});

app.post(
    '/api/data-port/customer-entry/import',
    requireSecureAuth,
    verifyEmployee,
    requireAnyPageAccess('bulk-entry'),
    requireActionPermission('configuration', 'add'),
    (req, res, next) => upload.single('file')(req, res, error => {
        if (error) return res.status(400).json({ error: error.message });
        return next();
    }),
    async (req, res) => {
        try {
            const previewOnly = ['true', '1'].includes(String(req.body.preview || req.query.preview || '').toLowerCase());
            if (!req.file) return res.status(400).json({ error: 'Choose an .xlsx or .csv file to upload.' });
            const extension = path.extname(req.file.originalname).toLowerCase();
            let rows;
            if (extension === '.xlsx') rows = await readSheet(req.file.buffer);
            else if (extension === '.csv') rows = parseCsv(req.file.buffer.toString('utf8'));
            else return res.status(400).json({ error: 'Only .xlsx and .csv files are supported.' });
            if (!rows.length) return res.status(400).json({ error: 'The uploaded file is empty.' });

            const rule = await importRuleFor('customer-entry');
            const applyRules = rule?.enabled !== false;
            const valueRules = applyRules ? (rule?.valueRules || {}) : {};
            const checkEmployeeMaster = applyRules && rule?.masterChecks?.employee === true;
            const checkDuplicates = applyRules && (rule?.duplicateKeys?.length || 0) > 0;
            const checkPositiveAmount = !applyRules || valueRules.positiveAmount === true;
            const checkPaymentMode = !applyRules || valueRules.paymentMode === true;
            const checkEmail = !applyRules || valueRules.email === true;
            const checkRemarkLength = !applyRules || valueRules.remarkLength === true;
            const maxRows = Math.min(1000, Math.max(1, Number(rule?.maxRows) || 1000));
            const dataRowCount = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim())).length;
            if (dataRowCount > maxRows) {
                return res.status(400).json({ error: `This file has ${dataRowCount} rows. The limit is ${maxRows} rows per import.` });
            }

            const headerIndexes = new Map();
            rows[0].forEach((header, index) => headerIndexes.set(normalizeHeader(header), index));
            const requiredHeaders = rule?.enabled && rule.requiredColumns?.length
                ? rule.requiredColumns
                : ['entryno', 'entrydate', 'staff', 'servicetype', 'amount', 'paymentmode'];
            const missingHeaders = requiredHeaders.filter(header => !headerIndexes.has(header));
            if (missingHeaders.length) {
                return res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(', ')}.` });
            }

            const config = await AppConfig.findOne({ key: 'collection' }).lean();
            const today = getTodayDate();
            const employees = await Employee.find({ status: 'Active' })
                .select('_id employeeId employeeName')
                .lean();
            const staffByName = new Map();
            const staffByCode = new Map();
            for (const employee of employees) {
                staffByName.set(String(employee.employeeName || '').trim().toLowerCase(), employee);
                staffByCode.set(String(employee.employeeId || '').trim().toLowerCase(), employee);
            }

            const previewColumns = ['Entry No', 'Entry Date', 'Staff', 'Service Type', 'Amount', 'Cost Cutting', 'Payment Mode', 'Email', 'Remark'];
            const previewRows = [];
            const documents = [];
            const documentPreviews = [];
            const errors = [];
            const suppliedIds = new Set();
            const suppliedEntryKeys = new Set();
            const addRowError = (preview, message, indexes = []) => {
                preview.errors.push(message);
                preview.errorIndexes.push(...indexes);
                errors.push(`Row ${preview.rowNumber}: ${message}`);
            };
            for (let index = 1; index < rows.length; index += 1) {
                const row = rows[index];
                if (!row.some(cell => String(cell ?? '').trim())) continue;
                const rawEntryNo = getCell(row, headerIndexes, ['entryno']);
                const entryNo = Number(rawEntryNo);
                const rawDate = getCell(row, headerIndexes, ['entrydate']);
                const entryDateText = rawDate instanceof Date
                    ? rawDate.toISOString().slice(0, 10)
                    : String(rawDate ?? '').trim().slice(0, 10);
                const entryDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entryDateText);
                const entryDate = entryDateMatch ? new Date(`${entryDateText}T00:00:00.000Z`) : null;
                const staff = String(getCell(row, headerIndexes, ['staff'])).trim();
                const serviceType = String(getCell(row, headerIndexes, ['servicetype'])).trim();
                const rawAmount = getCell(row, headerIndexes, ['amount']);
                const amount = Number(rawAmount);
                const rawCost = getCell(row, headerIndexes, ['costcutting']);
                const costCutting = rawCost === '' || rawCost === undefined ? 0 : Number(rawCost);
                const paymentMode = String(getCell(row, headerIndexes, ['paymentmode'])).trim();
                const rawRemark = String(getCell(row, headerIndexes, ['remark'])).trim();
                const remark = rawRemark.slice(0, 1000);
                const rawId = String(getCell(row, headerIndexes, ['_id', 'id'])).trim();
                const email = String(getCell(row, headerIndexes, ['email'])).trim().toLowerCase();
                const preview = {
                    rowNumber: index + 1,
                    cells: [
                        String(rawEntryNo ?? ''), entryDateText, staff, serviceType, String(rawAmount ?? ''),
                        String(rawCost ?? ''), paymentMode, email, rawRemark
                    ],
                    errors: [],
                    errorIndexes: []
                };
                previewRows.push(preview);
                const staffMatch = staffByName.get(staff.toLowerCase()) || staffByCode.get(staff.toLowerCase());
                if (!Number.isSafeInteger(entryNo) || entryNo <= 0) {
                    addRowError(preview, 'Entry No must be a positive whole number.', [0]);
                }
                if (!entryDate || Number.isNaN(entryDate.getTime()) || entryDate.toISOString().slice(0, 10) !== entryDateText) {
                    addRowError(preview, 'Entry Date must be a valid date in YYYY-MM-DD format.', [1]);
                } else if (staffMatch) {
                    const dateAccessError = await entryDateError(entryDateText, today, config, staffMatch._id);
                    if (dateAccessError) addRowError(preview, dateAccessError, [1]);
                } else if (entryDateText > today) {
                    addRowError(preview, 'Future entry dates are not allowed.', [1]);
                } else if (entryDateText < today) {
                    addRowError(preview, 'Staff must match an active employee for previous-date entries.', [2]);
                }
                if (!staff) {
                    addRowError(preview, 'Staff is required.', [2]);
                } else if (checkEmployeeMaster && !staffMatch) {
                    addRowError(preview, `Staff "${staff}" was not found in the active Employee Master.`, [2]);
                }
                if (!serviceType) addRowError(preview, 'Service Type is required.', [3]);
                if (!Number.isFinite(amount) || amount < 0) addRowError(preview, 'Amount must be 0 or greater.', [4]);
                else if (checkPositiveAmount && amount <= 0) addRowError(preview, 'Amount must be greater than 0.', [4]);
                if (!Number.isFinite(costCutting) || costCutting < 0) addRowError(preview, 'Cost Cutting must be 0 or greater.', [5]);
                if (checkPaymentMode && !['Cash', 'Online'].includes(paymentMode)) addRowError(preview, 'Payment Mode must be Cash or Online.', [6]);
                if (checkRemarkLength && rawRemark.length > 1000) addRowError(preview, 'Remark cannot be more than 1000 characters.', [8]);
                if (rawId && !mongoose.isValidObjectId(rawId)) addRowError(preview, 'The optional _id value is invalid.', []);
                if (checkEmail && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) addRowError(preview, 'Email address is invalid.', [7]);
                if (rawId && suppliedIds.has(rawId)) addRowError(preview, `Duplicate _id ${rawId} in the file.`, []);
                if (rawId) suppliedIds.add(rawId);
                if (checkDuplicates && entryDate && Number.isSafeInteger(entryNo)) {
                    const entryKey = `${entryDateText}:${entryNo}`;
                    if (suppliedEntryKeys.has(entryKey)) {
                        addRowError(preview, `Entry No ${entryNo} is duplicated for ${entryDateText} in the file.`, [0, 1]);
                    } else {
                        suppliedEntryKeys.add(entryKey);
                    }
                }
                if (preview.errors.length) continue;
                const rawCreatedAt = getCell(row, headerIndexes, ['createdat']);
                const createdAt = rawCreatedAt instanceof Date
                    ? rawCreatedAt
                    : rawCreatedAt ? new Date(rawCreatedAt) : undefined;
                const document = {
                    ...(rawId ? { _id: new mongoose.Types.ObjectId(rawId) } : {}),
                    entryNo,
                    entryDate,
                    staff,
                    ...(staffMatch ? { staffId: staffMatch._id } : {}),
                    serviceType,
                    amount,
                    costCutting,
                    paymentMode: ['Cash', 'Online'].includes(paymentMode) ? paymentMode : 'Cash',
                    remark,
                    email,
                    ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {})
                };
                documents.push(document);
                documentPreviews.push(preview);
            }
            if (checkDuplicates && documents.length) {
                const existingEntries = await CollectionEntry.find({
                    $or: documents.map(document => ({ entryDate: document.entryDate, entryNo: document.entryNo }))
                }).select('_id entryDate entryNo amount staff status').lean();
                const existingByKey = new Map(existingEntries.map(entry => [
                    `${entry.entryDate.toISOString().slice(0, 10)}:${entry.entryNo}`,
                    entry
                ]));
                for (let index = 0; index < documents.length; index += 1) {
                    const document = documents[index];
                    const preview = documentPreviews[index];
                    const key = `${document.entryDate.toISOString().slice(0, 10)}:${document.entryNo}`;
                    const existing = existingByKey.get(key);
                    if (existing && String(document._id || '') !== String(existing._id)) {
                        addRowError(
                            preview,
                            `Entry No ${document.entryNo} already exists for ${key.split(':')[0]} (Amount: ${existing.amount}, Staff: ${existing.staff}, Status: ${existing.status || 'Active'}).`,
                            [0, 1]
                        );
                    }
                }
            }
            const previewPayload = {
                preview: true,
                canImport: errors.length === 0 && documents.length > 0,
                columns: previewColumns,
                rows: previewRows,
                errors: errors.slice(0, 100),
                summary: {
                    total: previewRows.length,
                    valid: previewRows.filter(row => !row.errors.length).length,
                    invalid: previewRows.filter(row => row.errors.length).length
                }
            };
            if (previewOnly) return res.json(previewPayload);
            if (errors.length) {
                return res.status(400).json({
                    ...previewPayload,
                    preview: false,
                    error: 'Import stopped because some rows are invalid. Correct them and upload again; no entries were imported.'
                });
            }
            if (!documents.length) return res.status(400).json({ error: 'No customer entry rows found.' });

            const operations = documents.map(document => document._id
                ? { replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true } }
                : { insertOne: { document } });
            const result = await CollectionEntry.bulkWrite(operations, { ordered: true });
            await recordAudit(req, {
                action: 'IMPORT', page: 'Bulk Entry', module: 'Bulk Entry', recordType: 'Collection',
                metadata: { filename: req.file.originalname, processed: documents.length }
            });
            return res.json({
                message: 'Customer Entry data imported.',
                inserted: result.insertedCount + result.upsertedCount,
                updated: result.modifiedCount,
                processed: documents.length
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'An entry with the same Entry No. already exists for that date.' });
            }
            if (error.message.includes('Invalid') || error.message.includes('Unsupported')) {
                return res.status(400).json({ error: 'Could not read the spreadsheet. Check that it is a valid .xlsx or .csv file.' });
            }
            console.error('Customer Entry import error:', error);
            return res.status(500).json({ error: 'Could not import Customer Entry data.' });
        }
    }
);

app.post(
    '/api/data-port/employee-records/import',
    requireSecureAuth,
    verifyEmployee,
    requireAnyPageAccess('bulk-entry'),
    requireActionPermission('configuration', 'add'),
    (req, res, next) => upload.single('file')(req, res, error => {
        if (error) return res.status(400).json({ error: error.message });
        return next();
    }),
    async (req, res) => {
        try {
            const recordType = String(req.body.recordType || '').trim();
            if (!['expense', 'salary', 'counter'].includes(recordType)) {
                return res.status(400).json({ error: 'Select Expense, Salary, or Cash At Counter for import.' });
            }
            const previewOnly = ['true', '1'].includes(String(req.body.preview || req.query.preview || '').toLowerCase());
            if (!req.file) return res.status(400).json({ error: 'Choose an .xlsx or .csv file to upload.' });
            const extension = path.extname(req.file.originalname).toLowerCase();
            const rows = extension === '.xlsx'
                ? await readSheet(req.file.buffer)
                : extension === '.csv'
                    ? parseCsv(req.file.buffer.toString('utf8'))
                    : null;
            if (!rows) return res.status(400).json({ error: 'Only .xlsx and .csv files are supported.' });
            if (!rows.length) return res.status(400).json({ error: 'The uploaded file is empty.' });

            const rule = await importRuleFor(recordType);
            const maxRows = Math.min(1000, Math.max(1, Number(rule?.maxRows) || 1000));
            const dataRowCount = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim())).length;
            if (dataRowCount > maxRows) {
                return res.status(400).json({ error: `This file has ${dataRowCount} rows. The limit is ${maxRows} rows per import.` });
            }

            const headerIndexes = new Map();
            rows[0].forEach((header, index) => headerIndexes.set(normalizeHeader(header), index));
            const configuredHeaders = rule?.enabled && rule.requiredColumns?.length
                ? rule.requiredColumns
                : null;
            const requiredHeaders = configuredHeaders
                ? [...configuredHeaders]
                : ['employeeid', 'entrydate', 'amount'];
            if (!configuredHeaders) {
                if (recordType !== 'counter') requiredHeaders.push('paymentmode');
                if (recordType === 'expense') requiredHeaders.push('expensetypesr');
                if (recordType === 'salary') requiredHeaders.push('salarymonth');
            }
            const missingHeaders = requiredHeaders.filter(header => !headerIndexes.has(header));
            if (missingHeaders.length) return res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(', ')}.` });

            const employeeIds = [...new Set(rows.slice(1)
                .map(row => String(getCell(row, headerIndexes, ['employeeid'])).trim())
                .filter(Boolean))];
            const employees = await Employee.find({ employeeId: { $in: employeeIds }, status: 'Active' }).lean();
            const employeesById = new Map(employees.map(employee => [employee.employeeId, employee]));
            const config = await AppConfig.findOne({ key: 'collection' }).lean();
            const today = getTodayDate();
            const previewColumns = recordType === 'expense'
                ? ['Employee ID', 'Entry Date', 'Expense Type SR', 'Amount', 'Payment Mode', 'Remark']
                : recordType === 'salary'
                    ? ['Employee ID', 'Entry Date', 'Salary Month', 'Amount', 'Payment Mode', 'Remark']
                    : ['Employee ID', 'Entry Date', 'Amount', 'Remark'];
            const previewRows = [];
            const documentPreviews = [];
            const documents = [];
            const errors = [];
            for (let index = 1; index < rows.length; index += 1) {
                const row = rows[index];
                if (!row.some(cell => String(cell ?? '').trim())) continue;
                const employeeId = String(getCell(row, headerIndexes, ['employeeid'])).trim();
                const employee = employeesById.get(employeeId);
                const rawDate = getCell(row, headerIndexes, ['entrydate']);
                const entryDateText = rawDate instanceof Date
                    ? rawDate.toISOString().slice(0, 10)
                    : String(rawDate ?? '').trim().slice(0, 10);
                const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entryDateText);
                const date = dateMatch ? new Date(`${entryDateText}T00:00:00.000Z`) : null;
                const rawAmount = getCell(row, headerIndexes, ['amount']);
                const amount = Number(rawAmount);
                const paymentMode = recordType === 'counter'
                    ? 'Cash'
                    : String(getCell(row, headerIndexes, ['paymentmode'])).trim();
                const expenseTypeSr = recordType === 'expense'
                    ? Number(getCell(row, headerIndexes, ['expensetypesr'])) : undefined;
                const salaryMonth = recordType === 'salary'
                    ? String(getCell(row, headerIndexes, ['salarymonth'])).trim() : undefined;
                const rawRemark = String(getCell(row, headerIndexes, ['remark', 'remarks'])).trim();
                const preview = {
                    rowNumber: index + 1,
                    cells: recordType === 'expense'
                        ? [employeeId, entryDateText, String(expenseTypeSr ?? ''), String(rawAmount ?? ''), paymentMode, rawRemark]
                        : recordType === 'salary'
                            ? [employeeId, entryDateText, salaryMonth, String(rawAmount ?? ''), paymentMode, rawRemark]
                            : [employeeId, entryDateText, String(rawAmount ?? ''), rawRemark],
                    errors: [],
                    errorIndexes: []
                };
                previewRows.push(preview);
                const addError = (message, indexes) => {
                    preview.errors.push(message);
                    preview.errorIndexes.push(...indexes);
                    errors.push(`Row ${preview.rowNumber}: ${message}`);
                };
                let expenseType = '';
                if (recordType === 'expense' && Number.isSafeInteger(expenseTypeSr)) {
                    const type = await ExpenseType.findOne({ sr: expenseTypeSr, status: 'Active' }).lean();
                    expenseType = type?.name || '';
                }
                const dateAccessError = employee && date
                    ? await entryDateError(entryDateText, today, config, employee._id)
                    : null;
                if (!employee) addError('Employee ID was not found in the active Employee Master.', [0]);
                if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entryDateText) {
                    addError('Entry Date must be a valid date in YYYY-MM-DD format.', [1]);
                } else if (dateAccessError) {
                    addError(dateAccessError, [1]);
                }
                if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
                    addError('Amount must be greater than 0 and within the allowed range.', [recordType === 'counter' ? 2 : 3]);
                }
                if (recordType !== 'counter' && !['Cash', 'Online'].includes(paymentMode)) {
                    addError('Payment Mode must be Cash or Online.', [4]);
                }
                if (recordType === 'expense' && (!Number.isSafeInteger(expenseTypeSr) || !expenseType)) {
                    addError('Expense Type SR must match an active Expense Type.', [2]);
                }
                if (recordType === 'salary' && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(salaryMonth) || salaryMonth > today.slice(0, 7))) {
                    addError('Salary Month must be YYYY-MM and not in the future.', [2]);
                }
                if (rawRemark.length > 1000) addError('Remark cannot be more than 1000 characters.', [preview.cells.length - 1]);
                if (preview.errors.length) continue;
                documents.push({
                    recordType,
                    employeeId: employee._id,
                    employeeName: employee.employeeName,
                    entryDate: date,
                    ...(recordType === 'expense' ? { expenseTypeSr, expenseType } : {}),
                    ...(recordType === 'salary' ? { salaryMonth } : {}),
                    paymentMode,
                    amount,
                    remark: rawRemark.slice(0, 1000),
                    createdBy: req.employee.employeeName || 'Admin'
                });
                documentPreviews.push(preview);
            }
            const duplicateKeys = rule?.enabled
                ? (rule.duplicateKeys || []).filter(key => ({
                    employeeid: 'employeeId',
                    entrydate: 'entryDate',
                    expensetypesr: 'expenseTypeSr',
                    salarymonth: 'salaryMonth',
                    amount: 'amount',
                    paymentmode: 'paymentMode',
                    remark: 'remark'
                })[key])
                : [];
            if (duplicateKeys.length && documents.length) {
                const fieldByKey = {
                    employeeid: 'employeeId',
                    entrydate: 'entryDate',
                    expensetypesr: 'expenseTypeSr',
                    salarymonth: 'salaryMonth',
                    amount: 'amount',
                    paymentmode: 'paymentMode',
                    remark: 'remark'
                };
                const duplicateValue = (record, key) => {
                    const value = record[fieldByKey[key]];
                    if (key === 'entrydate') {
                        return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '');
                    }
                    return value instanceof Date ? value.toISOString() : String(value ?? '');
                };
                const duplicateKeyText = record => duplicateKeys.map(key => duplicateValue(record, key)).join('\u0001');
                const filters = documents.map(document => Object.fromEntries(
                    duplicateKeys.map(key => [fieldByKey[key], key === 'entrydate'
                        ? document.entryDate
                        : document[fieldByKey[key]]])
                ));
                const existingRecords = await EmployeeRecord.find({
                    recordType,
                    status: 'Active',
                    $or: filters
                }).select('employeeId entryDate expenseTypeSr salaryMonth amount paymentMode remark').lean();
                const existingKeys = new Map(existingRecords.map(record => [duplicateKeyText(record), record]));
                const fileKeys = new Map();
                for (let index = documents.length - 1; index >= 0; index -= 1) {
                    const document = documents[index];
                    const preview = documentPreviews[index];
                    const key = duplicateKeyText(document);
                    const existing = existingKeys.get(key) || fileKeys.get(key);
                    if (!existing) {
                        fileKeys.set(key, document);
                        continue;
                    }
                    const message = `Duplicate record already exists for ${duplicateKeys.join(', ')}.`;
                    if (rule.duplicateAction === 'skip') {
                        documents.splice(index, 1);
                        documentPreviews.splice(index, 1);
                    } else {
                        preview.errors.push(message);
                        preview.errorIndexes.push(0);
                        errors.push(`Row ${preview.rowNumber}: ${message}`);
                    }
                }
            }
            const previewPayload = {
                preview: true,
                canImport: errors.length === 0 && documents.length > 0,
                columns: previewColumns,
                rows: previewRows,
                errors: errors.slice(0, 100),
                summary: {
                    total: previewRows.length,
                    valid: previewRows.filter(row => !row.errors.length).length,
                    invalid: previewRows.filter(row => row.errors.length).length
                }
            };
            if (previewOnly) return res.json(previewPayload);
            if (errors.length) return res.status(400).json({
                ...previewPayload,
                preview: false,
                error: 'Import stopped because some rows are invalid. Correct them and upload again; no records were imported.'
            });
            if (!documents.length) return res.status(400).json({ error: 'No valid records found.' });
            const inserted = await EmployeeRecord.insertMany(documents, { ordered: true });
            await recordAudit(req, {
                action: 'IMPORT', page: 'Bulk Entry', module: 'Bulk Entry', recordType,
                metadata: { filename: req.file.originalname, processed: inserted.length }
            });
            return res.json({ message: `${recordType} records imported.`, inserted: inserted.length, updated: 0, processed: inserted.length });
        } catch (error) {
            console.error('Employee record import error:', error);
            return res.status(500).json({ error: 'Could not import the selected records.' });
        }
    }
);

app.post('/api/employees', requireSecureAuth, verifyEmployee, requireAnyPageAccess('employee-entry', 'employee-list'), requireActionPermission('employees', 'add'), async (req, res) => {
    try {
        const fieldDefinitions = (await EmployeeField.find().lean())
            .filter(field => !isRedundantMobileField(field));
        const expenseTypes = await resolveEmployeeExpenseTypes(req.body);
        const normalized = normalizeEmployee(req.body, fieldDefinitions);
        if (!normalized.userId) {
            return res.status(400).json({ error: 'User ID is required for employee login.' });
        }
        if (await Employee.exists({ userId: normalized.userId })) {
            return res.status(409).json({ error: 'That User ID is already assigned to another employee.' });
        }
        const employee = await Employee.create({
            ...normalized,
            ...expenseTypes,
            passwordHash: await bcrypt.hash('1234', 10),
            mustChangePassword: true
        });
        await recordAudit(req, {
            action: 'CREATE', page: 'Employee List', module: 'Employees', recordType: 'Employee',
            recordId: String(employee._id), newValue: employee
        });
        return res.status(201).json(employee);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Employee ID or email address already exists.' });
        }
        if (error instanceof EmployeeInputError || error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        console.error('Employee create error:', error);
        return res.status(500).json({ error: 'Could not create employee.' });
    }
});

app.put('/api/employees/:id', requireSecureAuth, verifyEmployee, requireAnyPageAccess('employee-entry', 'employee-list'), requireActionPermission('employees', 'edit'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid employee ID.' });
        }
        const fieldDefinitions = (await EmployeeField.find().lean())
            .filter(field => !isRedundantMobileField(field));
        const expenseTypes = await resolveEmployeeExpenseTypes(req.body);
        const normalized = normalizeEmployee(req.body, fieldDefinitions);
        if (!normalized.userId) {
            return res.status(400).json({ error: 'User ID is required for employee login.' });
        }
        if (await Employee.exists({ userId: normalized.userId, _id: { $ne: req.params.id } })) {
            return res.status(409).json({ error: 'That User ID is already assigned to another employee.' });
        }
        const currentEmployee = await Employee.findById(req.params.id).select('+passwordHash');
        if (!currentEmployee) return res.status(404).json({ error: 'Employee not found.' });
        const employee = await Employee.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...normalized,
                    ...expenseTypes,
                    ...(!currentEmployee.passwordHash ? {
                        passwordHash: await bcrypt.hash('1234', 10),
                        mustChangePassword: true
                    } : {})
                }
            },
            { returnDocument: 'after', runValidators: true }
        );
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });
        if (employee.status === 'Inactive') {
            await Promise.all([
                AppConfig.updateMany(
                    { key: 'collection' },
                    {
                        $pull: {
                            'permissions.$[].employeeIds': employee._id,
                            accessRules: { employeeId: employee._id },
                            employeeAllowedDates: { employeeId: employee._id }
                        }
                    }
                ),
                EmployeeDateAccess.deleteMany({ employeeId: employee._id })
            ]);
        }
        await recordAudit(req, {
            action: 'UPDATE', page: 'Employee List', module: 'Employees', recordType: 'Employee',
            recordId: String(employee._id), oldValue: currentEmployee, newValue: employee
        });
        return res.json(employee);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Employee ID already exists.' });
        }
        if (error instanceof EmployeeInputError || error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        console.error('Employee update error:', error);
        return res.status(500).json({ error: 'Could not update employee.' });
    }
});

app.patch('/api/employees/:id/deactivate', requireSecureAuth, verifyEmployee, requireAnyPageAccess('employee-list'), requireActionPermission('employees', 'deactivate'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid employee ID.' });
        }
        const before = await Employee.findById(req.params.id).lean();
        const employee = await Employee.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'Inactive' } },
            { returnDocument: 'after', runValidators: true }
        ).lean();
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });
        await Promise.all([
            AppConfig.updateMany(
                { key: 'collection' },
                {
                    $pull: {
                        'permissions.$[].employeeIds': employee._id,
                        accessRules: { employeeId: employee._id },
                        employeeAllowedDates: { employeeId: employee._id }
                    }
                }
            ),
            EmployeeDateAccess.deleteMany({ employeeId: employee._id })
        ]);
        await recordAudit(req, {
            action: 'DEACTIVATE', page: 'Employee List', module: 'Employees', recordType: 'Employee',
            recordId: String(employee._id), oldValue: before, newValue: employee
        });
        return res.json({ message: 'Employee deactivated.', employee });
    } catch (error) {
        console.error('Employee deactivation error:', error);
        return res.status(500).json({ error: 'Could not deactivate employee.' });
    }
});

app.post('/api/super-admin/bulk-delete', requireSecureAuth, verifyEmployee, requireSuperAdmin, async (req, res) => {
    try {
        const moduleKey = String(req.body.module || '').trim();
        const ids = [...new Set(
            (Array.isArray(req.body.ids) ? req.body.ids : []).map(id => String(id || '').trim())
        )];
        if (!ids.length) {
            return res.status(400).json({ error: 'Select at least one row to delete.' });
        }
        if (ids.length > 500) {
            return res.status(400).json({ error: 'Up to 500 rows can be deleted at a time.' });
        }
        if (ids.some(id => !mongoose.isValidObjectId(id))) {
            return res.status(400).json({ error: 'The selection contains an invalid row.' });
        }

        if (moduleKey === 'employee') {
            const employees = await Employee.find({ _id: { $in: ids } }).lean();
            if (!employees.length) {
                return res.status(404).json({ error: 'The selected employees were not found.' });
            }
            const employeeIds = employees.map(employee => employee._id);
            const [collectionCount, recordCount, dateAccessCount] = await Promise.all([
                CollectionEntry.countDocuments({ staffId: { $in: employeeIds } }),
                EmployeeRecord.countDocuments({ employeeId: { $in: employeeIds } }),
                EmployeeDateAccess.countDocuments({ employeeId: { $in: employeeIds } })
            ]);
            await EmployeeDateAccess.deleteMany({ employeeId: { $in: employeeIds } });
            await CollectionEntry.deleteMany({ staffId: { $in: employeeIds } });
            await EmployeeRecord.deleteMany({ employeeId: { $in: employeeIds } });
            await AppConfig.updateMany(
                { key: 'collection' },
                {
                    $pull: {
                        'permissions.$[].employeeIds': { $in: employeeIds },
                        accessRules: { employeeId: { $in: employeeIds } },
                        employeeAllowedDates: { employeeId: { $in: employeeIds } }
                    }
                }
            );
            const result = await Employee.deleteMany({ _id: { $in: employeeIds } });
            await recordAudit(req, {
                action: 'BULK_DELETE', page: 'Employee List', module: 'Employees',
                recordType: 'Employee',
                recordId: ids.length === 1 ? ids[0] : `${ids.length} employees`,
                oldValue: employees.map(employee => ({
                    _id: String(employee._id),
                    employeeId: employee.employeeId,
                    employeeName: employee.employeeName,
                    role: employee.role,
                    status: employee.status
                })),
                metadata: {
                    requestedIds: ids,
                    deletedCount: result.deletedCount,
                    collectionEntriesDeleted: collectionCount,
                    employeeRecordsDeleted: recordCount,
                    dateAccessDeleted: dateAccessCount
                }
            });
            return res.json({
                message: `${result.deletedCount} employee(s) permanently deleted.`,
                deleted: result.deletedCount,
                requested: ids.length,
                collectionEntriesDeleted: collectionCount,
                employeeRecordsDeleted: recordCount,
                dateAccessDeleted: dateAccessCount
            });
        }

        const definition = moduleDefinitions[moduleKey];
        if (!definition) {
            return res.status(400).json({ error: 'Select a valid table.' });
        }
        const isCollection = moduleKey === 'collection';
        const model = isCollection ? CollectionEntry : EmployeeRecord;
        const filter = isCollection
            ? { _id: { $in: ids } }
            : { _id: { $in: ids }, recordType: definition.recordType };
        const before = await model.find(filter).lean();
        if (!before.length) {
            return res.status(404).json({ error: 'The selected rows were not found.' });
        }
        const result = await model.deleteMany({ _id: { $in: before.map(row => row._id) } });
        await recordAudit(req, {
            action: 'BULK_DELETE',
            page: isCollection ? 'Collection Table' : `${definition.label} Table`,
            module: isCollection ? 'Customer Entry' : definition.permission,
            recordType: isCollection ? 'Collection' : 'EmployeeRecord',
            recordId: ids.length === 1 ? ids[0] : `${ids.length} records`,
            oldValue: before,
            metadata: { requestedIds: ids, deletedCount: result.deletedCount, table: moduleKey }
        });
        return res.json({
            message: `${result.deletedCount} row(s) permanently deleted.`,
            deleted: result.deletedCount,
            requested: ids.length
        });
    } catch (error) {
        console.error('Super Admin bulk delete error:', error);
        return res.status(500).json({ error: 'Could not permanently delete the selected rows.' });
    }
});

app.post(
    '/api/employees/import',
    requireSecureAuth,
    verifyEmployee,
    requireAnyPageAccess('bulk-entry'),
    requireActionPermission('configuration', 'add'),
    (req, res, next) => upload.single('file')(req, res, error => {
        if (error) return res.status(400).json({ error: error.message });
        return next();
    }),
    async (req, res) => {
        try {
            const previewOnly = ['true', '1'].includes(String(req.body.preview || req.query.preview || '').toLowerCase());
            if (!req.file) return res.status(400).json({ error: 'Choose an .xlsx or .csv file to upload.' });
            const extension = path.extname(req.file.originalname).toLowerCase();
            let rows;
            if (extension === '.xlsx') {
                rows = await readSheet(req.file.buffer);
            } else if (extension === '.csv') {
                rows = parseCsv(req.file.buffer.toString('utf8'));
            } else {
                return res.status(400).json({ error: 'Only .xlsx and .csv files are supported.' });
            }
            if (!rows.length) return res.status(400).json({ error: 'The uploaded file is empty.' });
            const rule = await importRuleFor('employees');
            const maxRows = Math.min(1000, Math.max(1, Number(rule?.maxRows) || 1000));
            const dataRowCount = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim())).length;
            if (dataRowCount > maxRows) {
                return res.status(400).json({ error: `This file has ${dataRowCount} rows. The limit is ${maxRows} rows per import.` });
            }

            if (rule?.enabled && rule.requiredColumns?.length) {
                const headerSet = new Set(rows[0].map(normalizeHeader));
                const missingHeaders = rule.requiredColumns.filter(header => !headerSet.has(normalizeHeader(header)));
                if (missingHeaders.length) {
                    return res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(', ')}.` });
                }
            }
            const fieldDefinitions = (await EmployeeField.find().lean())
                .filter(field => !isRedundantMobileField(field));
            const { employees, errors } = rowsToEmployees(rows, fieldDefinitions);
            const headers = rows[0].map(header => String(header ?? '').trim() || 'Column');
            const previewRows = [];
            const errorsByRow = new Map();
            for (const error of errors) {
                const match = /^Row (\d+):\s*(.*)$/.exec(error);
                if (!match) continue;
                const rowNumber = Number(match[1]);
                if (!errorsByRow.has(rowNumber)) errorsByRow.set(rowNumber, []);
                errorsByRow.get(rowNumber).push(match[2]);
            }
            for (let index = 1; index < rows.length; index += 1) {
                const row = rows[index];
                if (!row.some(cell => String(cell ?? '').trim())) continue;
                previewRows.push({
                    rowNumber: index + 1,
                    cells: headers.map((_, columnIndex) => String(row[columnIndex] ?? '')),
                    errors: errorsByRow.get(index + 1) || [],
                    errorIndexes: []
                });
            }
            const deduplicatedEmployees = new Map();
            for (const employee of employees) {
                try {
                    const resolvedExpenseTypes = await resolveEmployeeExpenseTypes(employee);
                    deduplicatedEmployees.set(employee.employeeId, {
                        ...employee,
                        ...resolvedExpenseTypes
                    });
                } catch (error) {
                    errors.push(error.message);
                }
            }
            const previewPayload = {
                preview: true,
                canImport: errors.length === 0 && deduplicatedEmployees.size > 0,
                columns: headers,
                rows: previewRows,
                errors: errors.slice(0, 100),
                summary: {
                    total: previewRows.length,
                    valid: previewRows.filter(row => !row.errors.length).length,
                    invalid: previewRows.filter(row => row.errors.length).length
                }
            };
            if (previewOnly) return res.json(previewPayload);
            if (errors.length) {
                return res.status(400).json({
                    ...previewPayload,
                    preview: false,
                    canImport: false,
                    error: 'Import stopped because some rows are invalid. Correct them and upload again; no employees were imported.',
                    rowErrors: errors.slice(0, 25)
                });
            }
            if (!deduplicatedEmployees.size) {
                return res.status(400).json({
                    error: 'No valid employee rows found.',
                    rowErrors: errors.slice(0, 25)
                });
            }
            const employeeRows = [...deduplicatedEmployees.values()];
            const existingEmployees = await Employee.find({
                employeeId: { $in: employeeRows.map(employee => employee.employeeId) }
            }).select('employeeId +passwordHash').lean();
            const existingById = new Map(existingEmployees.map(employee => [employee.employeeId, employee]));
            const operations = await Promise.all(employeeRows.map(async employee => {
                const updateFields = { ...employee };
                const customFields = updateFields.customFields || {};
                delete updateFields.customFields;
                const expenseTypes = updateFields.expenseTypes || [];
                delete updateFields.expenseTypes;
                updateFields.expenseTypes = expenseTypes;
                const existing = existingById.get(employee.employeeId);
                if (!existing?.passwordHash) {
                    updateFields.passwordHash = await bcrypt.hash('1234', 10);
                    updateFields.mustChangePassword = true;
                }
                for (const [key, value] of Object.entries(customFields)) {
                    updateFields[`customFields.${key}`] = value;
                }
                return {
                    updateOne: {
                        filter: { employeeId: employee.employeeId },
                        update: { $set: updateFields },
                        upsert: true
                    }
                };
            }));
            const result = await Employee.bulkWrite(operations, { ordered: false });
            await recordAudit(req, {
                action: 'IMPORT', page: 'Bulk Entry', module: 'Bulk Entry', recordType: 'Employee',
                metadata: { filename: req.file.originalname, processed: operations.length, invalidRows: errors.length }
            });
            return res.json({
                message: 'Employee spreadsheet imported.',
                inserted: result.upsertedCount,
                updated: result.matchedCount,
                processed: operations.length,
                invalidRows: errors.length,
                rowErrors: errors.slice(0, 25)
            });
        } catch (error) {
            if (error.message.includes('must include') || error.message.includes('uploaded file is empty')) {
                return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('Invalid') || error.message.includes('Unsupported')) {
                return res.status(400).json({ error: 'Could not read the spreadsheet. Check that it is a valid .xlsx or .csv file.' });
            }
            console.error('Employee import error:', error);
            return res.status(500).json({ error: 'Could not import the employee spreadsheet.' });
        }
    }
);

app.get('/api/shop/:shopCode', async (req, res) => {
    try {
        const shop = await Shop.findOne({ shopCode: req.params.shopCode }).lean();
        if (!shop) return res.status(404).json({ error: 'Shop not found!' });
        return res.json({
            shopName: shop.shopName,
            shopCode: shop.shopCode,
            email: shop.email
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

class EmployeeRecordInputError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

async function prepareEmployeeRecordInput(req, recordType, employeeId = req.body.employeeId, action = 'add', options = {}) {
    const definition = moduleDefinitions[recordType];
    if (!definition || !['expense', 'salary', 'counter'].includes(recordType)) {
        throw new EmployeeRecordInputError('Select a valid entry form.');
    }
    if (!await hasActionAccess(req.employee, recordType, action)) {
        throw new EmployeeRecordInputError(`You do not have ${definition.permission} access.`, 403);
    }

    let targetEmployee = req.employee;
    if (isAdmin(req.employee)) {
        if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
            throw new EmployeeRecordInputError('Select an active employee.');
        }
        targetEmployee = await Employee.findOne({ _id: employeeId, status: 'Active' }).lean();
        if (!targetEmployee) throw new EmployeeRecordInputError('Employee not found or inactive.', 404);
    }
    if (!targetEmployee?._id) {
        throw new EmployeeRecordInputError('Select an employee account for this entry.');
    }

    const today = getTodayDate();
    const entryDate = String(req.body.entryDate || today);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entryDate);
    const date = match ? new Date(`${entryDate}T00:00:00.000Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entryDate) {
        throw new EmployeeRecordInputError('Select a valid entry date.');
    }
    const config = await AppConfig.findOne({ key: 'collection' }).lean();
    const existingEntryDate = options.existingEntryDate
        ? String(options.existingEntryDate).slice(0, 10)
        : '';
    // Unrestricted date entry for expense / advance records
    if (recordType !== 'expense') {
        const dateError = await entryDateError(entryDate, today, config, targetEmployee._id);
        if (dateError && entryDate !== existingEntryDate) {
            throw new EmployeeRecordInputError(dateError);
        }
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
        throw new EmployeeRecordInputError('Enter a valid amount greater than zero.');
    }
    const paymentMode = recordType === 'counter' ? 'Cash' : String(req.body.paymentMode || '');
    if (!['Cash', 'Online'].includes(paymentMode)) {
        throw new EmployeeRecordInputError('Select Cash or Online as the payment mode.');
    }

    let expenseTypeSr;
    let expenseType = '';
    if (recordType === 'expense') {
        // Default to sr 1 (Advance Amount) if not specified
        expenseTypeSr = Number(req.body.expenseTypeSr || 1);
        if (!Number.isSafeInteger(expenseTypeSr) || expenseTypeSr < 1) {
            throw new EmployeeRecordInputError('Select an active expense type.');
        }
        const catalogType = await ExpenseType.findOne({ sr: expenseTypeSr, status: 'Active' }).lean();
        if (!catalogType) throw new EmployeeRecordInputError('Select an active expense type.');
        if (!isAdmin(req.employee) &&
            catalogType.sr !== 1 &&
            !/advance/i.test(catalogType.name) &&
            !(targetEmployee.expenseTypes || []).some(item => Number(item.sr) === catalogType.sr)) {
            throw new EmployeeRecordInputError('This expense type is not assigned to your employee account.', 403);
        }
        expenseType = catalogType.name;
    }

    let salaryMonth;
    if (recordType === 'salary') {
        salaryMonth = String(req.body.salaryMonth || entryDate.slice(0, 7));
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(salaryMonth)) {
            throw new EmployeeRecordInputError('Select a valid salary month.');
        }
        if (salaryMonth > today.slice(0, 7)) {
            throw new EmployeeRecordInputError('Future salary months are not allowed.');
        }
    }

    return {
        recordType,
        permissionCategory: definition.permission,
        targetEmployee,
        date,
        expenseTypeSr,
        expenseType,
        salaryMonth,
        paymentMode,
        amount,
        remark: String(req.body.remark || '').trim().slice(0, 1000)
    };
}

app.post('/api/employee-records', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        const input = await prepareEmployeeRecordInput(req, String(req.body.recordType || ''), req.body.employeeId, 'add');
        const record = await EmployeeRecord.create({
            recordType: input.recordType,
            employeeId: input.targetEmployee._id,
            employeeName: input.targetEmployee.employeeName,
            entryDate: input.date,
            ...(input.expenseTypeSr ? { expenseTypeSr: input.expenseTypeSr, expenseType: input.expenseType } : {}),
            ...(input.salaryMonth ? { salaryMonth: input.salaryMonth } : {}),
            paymentMode: input.paymentMode,
            amount: input.amount,
            remark: input.remark,
            createdBy: req.employee.employeeName || 'Admin'
        });
        await recordAudit(req, {
            action: 'CREATE', page: `${input.recordType} Entry`, module: input.permissionCategory,
            recordType: 'EmployeeRecord', recordId: String(record._id), newValue: record
        });
        return res.status(201).json({ message: 'Entry saved successfully.', record });
    } catch (error) {
        if (error instanceof EmployeeRecordInputError || error.name === 'ValidationError') {
            return res.status(error.status || 400).json({ error: error.message });
        }
        console.error('Employee entry save error:', error);
        return res.status(500).json({ error: 'Could not save the entry.' });
    }
});

app.put('/api/employee-records/:id', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid employee record.' });
        }
        const scope = { _id: req.params.id };
        if (!isAdmin(req.employee)) scope.employeeId = req.employee._id;
        const before = await EmployeeRecord.findOne(scope).lean();
        if (!before) return res.status(404).json({ error: 'Employee record not found.' });
        const recordType = String(req.body.recordType || before.recordType);
        if (recordType !== before.recordType) {
            return res.status(400).json({ error: 'The record type cannot be changed.' });
        }
        const input = await prepareEmployeeRecordInput(
            req,
            before.recordType,
            req.body.employeeId || before.employeeId,
            'edit',
            { existingEntryDate: before.entryDate }
        );
        const update = {
            $set: {
                recordType: input.recordType,
                employeeId: input.targetEmployee._id,
                employeeName: input.targetEmployee.employeeName,
                entryDate: input.date,
                paymentMode: input.paymentMode,
                amount: input.amount,
                remark: input.remark
            }
        };
        if (input.expenseTypeSr) {
            update.$set.expenseTypeSr = input.expenseTypeSr;
            update.$set.expenseType = input.expenseType;
        } else {
            update.$unset = { expenseTypeSr: 1, expenseType: 1 };
        }
        if (input.salaryMonth) update.$set.salaryMonth = input.salaryMonth;
        else update.$unset = { ...(update.$unset || {}), salaryMonth: 1 };
        const record = await EmployeeRecord.findOneAndUpdate(scope, update, {
            new: true,
            runValidators: true
        }).lean();
        if (!record) return res.status(404).json({ error: 'Employee record not found.' });
        await recordAudit(req, {
            action: 'UPDATE', page: `${input.recordType} Table`, module: input.permissionCategory,
            recordType: 'EmployeeRecord', recordId: String(record._id), oldValue: before, newValue: record
        });
        return res.json({ message: 'Entry updated successfully.', record });
    } catch (error) {
        if (error instanceof EmployeeRecordInputError || error.name === 'ValidationError') {
            return res.status(error.status || 400).json({ error: error.message });
        }
        console.error('Employee entry update error:', error);
        return res.status(500).json({ error: 'Could not update the entry.' });
    }
});

app.delete('/api/employee-records/:id', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid employee record.' });
        }
        const scope = { _id: req.params.id };
        if (!isAdmin(req.employee)) scope.employeeId = req.employee._id;
        const before = await EmployeeRecord.findOne(scope).lean();
        if (!before) return res.status(404).json({ error: 'Employee record not found.' });
        const definition = moduleDefinitions[before.recordType];
        if (!definition || !await hasActionAccess(req.employee, before.recordType, 'delete')) {
            return res.status(403).json({ error: 'You do not have permission to delete this record.' });
        }
        const record = await EmployeeRecord.findOneAndUpdate(
            scope,
            { $set: { status: 'Inactive', inactiveAction: 'Deleted', inactiveAt: new Date(), inactiveBy: req.employee.employeeName || 'Admin' } },
            { new: true, runValidators: true }
        ).lean();
        await recordAudit(req, {
            action: 'DELETE', page: `${before.recordType} Table`, module: definition.permission,
            recordType: 'EmployeeRecord', recordId: String(before._id), oldValue: before, newValue: record
        });
        return res.json({ message: 'Entry moved to In-Active.', record });
    } catch (error) {
        console.error('Employee entry delete error:', error);
        return res.status(500).json({ error: 'Could not move the entry to In-Active.' });
    }
});

app.patch('/api/employee-records/:id/deactivate', requireSecureAuth, verifyEmployee, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid employee record.' });
        }
        const scope = { _id: req.params.id };
        if (!isAdmin(req.employee)) scope.employeeId = req.employee._id;
        const before = await EmployeeRecord.findOne(scope).lean();
        if (!before) return res.status(404).json({ error: 'Employee record not found.' });
        const definition = moduleDefinitions[before.recordType];
        if (!definition || !await hasActionAccess(req.employee, before.recordType, 'deactivate')) {
            return res.status(403).json({ error: 'You do not have permission to deactivate this record.' });
        }
        const record = await EmployeeRecord.findOneAndUpdate(
            scope,
            { $set: { status: 'Inactive', inactiveAction: 'Deactivated', inactiveAt: new Date(), inactiveBy: req.employee.employeeName || 'Admin' } },
            { new: true, runValidators: true }
        ).lean();
        await recordAudit(req, {
            action: 'DEACTIVATE', page: `${before.recordType} Table`, module: definition.permission,
            recordType: 'EmployeeRecord', recordId: String(before._id), oldValue: before, newValue: record
        });
        return res.json({ message: 'Entry deactivated.', record });
    } catch (error) {
        console.error('Employee entry deactivation error:', error);
        return res.status(500).json({ error: 'Could not deactivate the entry.' });
    }
});

async function verifyCollectionAccess(req, res, next) {
    try {
        if (isAdmin(req.employee)) return next();
        const config = await AppConfig.findOne({ key: 'collection' }).lean();
        const rule = accessRuleFor(config, req.employee);
        if (rule) {
            if (rule.pages.includes('collection-records') || rule.pages.includes('collection-entry')) return next();
            return res.status(403).json({ error: 'You do not have Customer Entry access.' });
        }
        if (permissionAllows(config, req.employee, 'Customer Entry')) return next();
        return res.status(403).json({ error: 'You do not have Customer Entry access.' });
    } catch (error) {
        console.error('Collection permission check error:', error);
        return res.status(500).json({ error: 'Could not verify Customer Entry access.' });
    }
}

app.get('/api/collections', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'MongoDB is not connected. Please try again shortly.' });
        }

        const requestedPage = Number.parseInt(req.query.page, 10);
        const limit = 100;
        const filter = await employeeCollectionFilter(req.employee);
        if (!await hasActionAccess(req.employee, 'collection', 'view')) {
            return res.status(403).json({ error: 'You do not have Collection view access.' });
        }
        applyStatusFilter(filter, req.query.status);
        const total = await CollectionEntry.countDocuments(filter);
        const page = Math.min(
            Number.isSafeInteger(requestedPage) ? Math.max(requestedPage, 1) : 1,
            Math.max(1, Math.ceil(total / limit))
        );
        const entries = await CollectionEntry.find(filter)
            .sort({ entryDate: -1, createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('entryNo entryDate staff serviceType items amount costCutting paymentMode remark createdBy email createdAt status inactiveAction inactiveAt inactiveBy')
            .lean();
        const legacyEmails = [...new Set(entries
            .filter(entry => !entry.createdBy && entry.email)
            .map(entry => entry.email.toLowerCase()))];
        const legacyEmployees = legacyEmails.length
            ? await Employee.find({ emailAddress: { $in: legacyEmails } }).select('emailAddress employeeName').lean()
            : [];
        const employeeNamesByEmail = new Map(legacyEmployees.map(employee => [
            employee.emailAddress.toLowerCase(),
            employee.employeeName
        ]));
        const resultEntries = entries.map(({ email, ...entry }) => ({
            ...entry,
            createdBy: entry.createdBy || employeeNamesByEmail.get((email || '').toLowerCase()) || '—'
        }));

        return res.json({ entries: resultEntries, page, limit, total });
    } catch (error) {
        console.error('Collection list error:', error);
        return res.status(500).json({ error: 'Could not load customer entries.' });
    }
});

app.post('/api/save-collection', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        if (!await hasActionAccess(req.employee, 'collection', 'add')) {
            return res.status(403).json({ error: 'You do not have Collection add access.' });
        }
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'MongoDB is not connected. Please try again shortly.' });
        }

        const { entryNo, entryDate, staff, serviceType, amount, costCutting, paymentMode } = req.body;
        const remark = String(req.body.remark || '').trim().slice(0, 1000);
        const numericEntryNo = Number(entryNo);
        const numericAmount = Number(amount);
        const numericCostCutting = costCutting === undefined || costCutting === ''
            ? 0
            : Number(costCutting);
        const parsedItems = normalizeCollectionItems(req.body.items);
        const dateMatch = typeof entryDate === 'string'
            ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(entryDate)
            : null;
        const parsedEntryDate = dateMatch ? new Date(`${entryDate}T00:00:00.000Z`) : null;
        const validEntryDate = Boolean(
            parsedEntryDate &&
            !Number.isNaN(parsedEntryDate.getTime()) &&
            parsedEntryDate.toISOString().slice(0, 10) === entryDate
        );

        if (!Number.isSafeInteger(numericEntryNo) || numericEntryNo <= 0) {
            return res.status(400).json({ error: 'Please enter a valid Entry No.' });
        }
        if (!validEntryDate) {
            return res.status(400).json({ error: 'Please select a valid entry date.' });
        }
        const config = await AppConfig.findOne({ key: 'collection' }).lean();
        const today = getTodayDate();
        if (entryDate > today) {
            return res.status(400).json({ error: 'Future entry dates are not allowed.' });
        }
        if (typeof staff !== 'string' || !staff.trim()) {
            return res.status(400).json({ error: 'Please select a staff member.' });
        }
        const staffFilter = isAdmin(req.employee)
            ? mongoose.isValidObjectId(req.body.staffId)
                ? { _id: req.body.staffId, status: 'Active' }
                : { employeeName: staff.trim(), status: 'Active' }
            : { _id: req.employee._id, status: 'Active' };
        const activeStaff = await Employee.findOne(staffFilter).select('_id employeeName').lean();
        if (!activeStaff) {
            return res.status(400).json({ error: 'Select an active employee from the staff list.' });
        }
        if (!isAdmin(req.employee) && activeStaff._id.toString() !== req.employee._id.toString()) {
            return res.status(403).json({ error: 'Employees can only add their own collection entries.' });
        }
        const dateError = await entryDateError(entryDate, today, config, activeStaff._id);
        if (dateError) return res.status(400).json({ error: dateError });
        if (!parsedItems && (typeof serviceType !== 'string' || !serviceType.trim())) {
            return res.status(400).json({ error: 'Please add at least one service.' });
        }
        if (!parsedItems && (!Number.isFinite(numericAmount) || numericAmount <= 0)) {
            return res.status(400).json({ error: 'Please enter a valid amount.' });
        }
        if (!Number.isFinite(numericCostCutting) || numericCostCutting < 0) {
            return res.status(400).json({ error: 'Please enter a valid Cost Cutting amount.' });
        }
        if (!['Cash', 'Online'].includes(paymentMode)) {
            return res.status(400).json({ error: 'Please select a valid payment mode.' });
        }
        if (String(req.body.remark || '').trim().length > 1000) {
            return res.status(400).json({ error: 'Remark cannot exceed 1000 characters.' });
        }
        if (await CollectionEntry.exists({ entryDate: parsedEntryDate, entryNo: numericEntryNo })) {
            return res.status(409).json({ error: `Entry No. ${numericEntryNo} already exists for ${entryDate}.` });
        }

        const allocation = parsedItems
            ? allocateCollectionAmount(parsedItems, req.body.total, numericCostCutting, config)
            : null;
        const newEntry = await CollectionEntry.create({
            entryNo: numericEntryNo,
            entryDate: parsedEntryDate,
            staffId: isAdmin(req.employee) ? activeStaff._id : req.employee._id,
            staff: activeStaff.employeeName,
            serviceType: parsedItems ? parsedItems.summary : serviceType.trim(),
            ...(parsedItems ? { items: parsedItems.items } : {}),
            amount: allocation ? allocation.amount : numericAmount,
            costCutting: allocation ? allocation.costCutting : numericCostCutting,
            paymentMode,
            remark,
            createdBy: req.employee?.employeeName || '',
            email: req.employee?.emailAddress || ''
        });
        await recordAudit(req, {
            action: 'CREATE', page: 'Collection Entry', module: 'Customer Entry',
            recordType: 'Collection', recordId: String(newEntry._id), newValue: newEntry
        });

        return res.status(201).json({
            message: 'Collection saved successfully.',
            entryNo: newEntry.entryNo,
            record: newEntry
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'An entry with the same Entry No. already exists for that date.' });
        }
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('Collection save error:', error);
        return res.status(500).json({ error: 'Could not save the collection entry.' });
    }
});

app.put('/api/collections/:id', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        if (!await hasActionAccess(req.employee, 'collection', 'edit')) {
            return res.status(403).json({ error: 'You do not have Collection edit access.' });
        }
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'MongoDB is not connected. Please try again shortly.' });
        }
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid customer entry.' });
        }

        const updateFilter = { _id: req.params.id, ...await employeeCollectionFilter(req.employee) };
        const before = await CollectionEntry.findOne(updateFilter).lean();
        if (!before) return res.status(404).json({ error: 'Customer entry not found.' });

        const { entryNo, entryDate, staff, serviceType, amount, costCutting, paymentMode } = req.body;
        const remark = String(req.body.remark || '').trim().slice(0, 1000);
        const numericEntryNo = Number(entryNo);
        const numericAmount = Number(amount);
        const numericCostCutting = costCutting === undefined || costCutting === '' ? 0 : Number(costCutting);
        const parsedItems = normalizeCollectionItems(req.body.items);
        const dateMatch = typeof entryDate === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(entryDate) : null;
        const parsedEntryDate = dateMatch ? new Date(`${entryDate}T00:00:00.000Z`) : null;
        const validEntryDate = Boolean(
            parsedEntryDate &&
            !Number.isNaN(parsedEntryDate.getTime()) &&
            parsedEntryDate.toISOString().slice(0, 10) === entryDate
        );

        if (!Number.isSafeInteger(numericEntryNo) || numericEntryNo <= 0) {
            return res.status(400).json({ error: 'Please enter a valid Entry No.' });
        }
        if (!validEntryDate) return res.status(400).json({ error: 'Please select a valid entry date.' });

        const config = await AppConfig.findOne({ key: 'collection' }).lean();
        const today = getTodayDate();
        if (entryDate > today) {
            return res.status(400).json({ error: 'Future entry dates are not allowed.' });
        }
        if (typeof staff !== 'string' || !staff.trim()) {
            return res.status(400).json({ error: 'Please select a staff member.' });
        }
        const staffFilter = isAdmin(req.employee)
            ? mongoose.isValidObjectId(req.body.staffId)
                ? { _id: req.body.staffId, status: 'Active' }
                : { employeeName: staff.trim(), status: 'Active' }
            : { _id: req.employee._id, status: 'Active' };
        const activeStaff = await Employee.findOne(staffFilter).select('_id employeeName').lean();
        if (!activeStaff) return res.status(400).json({ error: 'Select an active employee from the staff list.' });
        if (!isAdmin(req.employee) && activeStaff._id.toString() !== req.employee._id.toString()) {
            return res.status(403).json({ error: 'Employees can only update their own collection entries.' });
        }
        const existingEntryDate = before.entryDate
            ? new Date(before.entryDate).toISOString().slice(0, 10)
            : '';
        const dateError = await entryDateError(entryDate, today, config, activeStaff._id);
        if (dateError && entryDate !== existingEntryDate) {
            return res.status(400).json({ error: dateError });
        }
        if (!parsedItems && (typeof serviceType !== 'string' || !serviceType.trim())) {
            return res.status(400).json({ error: 'Please add at least one service.' });
        }
        if (!parsedItems && (!Number.isFinite(numericAmount) || numericAmount <= 0)) {
            return res.status(400).json({ error: 'Please enter a valid amount.' });
        }
        if (!Number.isFinite(numericCostCutting) || numericCostCutting < 0) {
            return res.status(400).json({ error: 'Please enter a valid Cost Cutting amount.' });
        }
        if (!['Cash', 'Online'].includes(paymentMode)) {
            return res.status(400).json({ error: 'Please select a valid payment mode.' });
        }
        if (String(req.body.remark || '').trim().length > 1000) {
            return res.status(400).json({ error: 'Remark cannot exceed 1000 characters.' });
        }

        const duplicate = await CollectionEntry.exists({
            _id: { $ne: req.params.id },
            entryDate: parsedEntryDate,
            entryNo: numericEntryNo
        });
        if (duplicate) {
            return res.status(409).json({ error: `Entry No. ${numericEntryNo} already exists for ${entryDate}.` });
        }
        const preserveItems = !parsedItems &&
            Array.isArray(before.items) &&
            before.items.length > 0 &&
            serviceType.trim() === before.serviceType &&
            numericAmount === Number(before.amount || 0);
        const allocation = parsedItems
            ? allocateCollectionAmount(parsedItems, req.body.total, numericCostCutting, config)
            : null;
        const setFields = {
            entryNo: numericEntryNo,
            entryDate: parsedEntryDate,
            staffId: isAdmin(req.employee) ? activeStaff._id : req.employee._id,
            staff: activeStaff.employeeName,
            serviceType: parsedItems ? parsedItems.summary : serviceType.trim(),
            amount: allocation ? allocation.amount : numericAmount,
            costCutting: allocation ? allocation.costCutting : numericCostCutting,
            paymentMode,
            remark
        };
        if (parsedItems) setFields.items = parsedItems.items;
        const update = { $set: setFields };
        if (!parsedItems && !preserveItems) update.$unset = { items: 1 };
        const entry = await CollectionEntry.findOneAndUpdate(
            updateFilter,
            update,
            { new: true, runValidators: true }
        ).select('_id entryNo entryDate staff serviceType items amount costCutting paymentMode remark status');

        if (!entry) return res.status(404).json({ error: 'Customer entry not found.' });
        await recordAudit(req, {
            action: 'UPDATE', page: 'Collection Entry', module: 'Customer Entry',
            recordType: 'Collection', recordId: String(entry._id), oldValue: before, newValue: entry
        });
        return res.json({ message: 'Customer entry updated successfully.', entryNo: entry.entryNo, record: entry });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'An entry with the same Entry No. already exists for that date.' });
        }
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('Collection update error:', error);
        return res.status(500).json({ error: 'Could not update the customer entry.' });
    }
});

app.delete('/api/collections/:id', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        if (!await hasActionAccess(req.employee, 'collection', 'delete')) {
            return res.status(403).json({ error: 'You do not have Collection delete access.' });
        }
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'MongoDB is not connected. Please try again shortly.' });
        }
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid customer entry.' });
        }

        const deleteFilter = { _id: req.params.id, ...await employeeCollectionFilter(req.employee) };
        const before = await CollectionEntry.findOne(deleteFilter).lean();
        const entry = await CollectionEntry.findOneAndUpdate(
            deleteFilter,
            { $set: { status: 'Inactive', inactiveAction: 'Deleted', inactiveAt: new Date(), inactiveBy: req.employee.employeeName || 'Admin' } },
            { new: true, runValidators: true }
        ).select('_id status inactiveAction');
        if (!entry) return res.status(404).json({ error: 'Customer entry not found.' });
        await recordAudit(req, {
            action: 'DELETE', page: 'Collection Table', module: 'Customer Entry',
            recordType: 'Collection', recordId: String(entry._id), oldValue: before, newValue: entry
        });
        return res.json({ message: 'Customer entry moved to In-Active.', entry });
    } catch (error) {
        console.error('Collection delete error:', error);
        return res.status(500).json({ error: 'Could not move the customer entry to In-Active.' });
    }
});

app.patch('/api/collections/:id/deactivate', requireSecureAuth, verifyEmployee, verifyCollectionAccess, async (req, res) => {
    try {
        if (!await hasActionAccess(req.employee, 'collection', 'deactivate')) {
            return res.status(403).json({ error: 'You do not have Collection deactivate access.' });
        }
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid customer entry.' });
        }
        const filter = { _id: req.params.id, ...await employeeCollectionFilter(req.employee) };
        const before = await CollectionEntry.findOne(filter).lean();
        const entry = await CollectionEntry.findOneAndUpdate(
            filter,
            { $set: { status: 'Inactive', inactiveAction: 'Deactivated', inactiveAt: new Date(), inactiveBy: req.employee.employeeName || 'Admin' } },
            { new: true, runValidators: true }
        ).select('_id status inactiveAction');
        if (!entry) return res.status(404).json({ error: 'Customer entry not found.' });
        await recordAudit(req, {
            action: 'DEACTIVATE', page: 'Collection Table', module: 'Customer Entry',
            recordType: 'Collection', recordId: String(entry._id), oldValue: before, newValue: entry
        });
        return res.json({ message: 'Customer entry deactivated.', entry });
    } catch (error) {
        console.error('Collection deactivation error:', error);
        return res.status(500).json({ error: 'Could not deactivate the customer entry.' });
    }
});

app.use((error, req, res, next) => {
    console.error('Unhandled request error:', error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    const runDateAccessMigration = () => {
        migrateLegacyDateAccess().catch(error => {
            console.error('Legacy date-access migration error:', error);
        });
    };
    if (mongoose.connection.readyState === 1) runDateAccessMigration();
    mongoose.connection.on('connected', runDateAccessMigration);
});
