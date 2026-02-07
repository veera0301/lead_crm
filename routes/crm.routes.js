const express = require('express');
const router = express.Router();

const ctrl = require('../controller/crm.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');


router.post('/auth/company/register', ctrl.registerCompany);
router.post('/auth/login', ctrl.login);
router.post('/auth/logout', authMiddleware, ctrl.logout);
router.post('/auth/forgot-password', ctrl.forgotPassword);
router.post('/auth/reset-password', ctrl.resetPassword);


router.post('/users/create', authMiddleware, allowRoles(2),ctrl.createUser);
router.get('/users/list',authMiddleware,allowRoles(2),ctrl.listUsers);
router.put('/users/:id',authMiddleware,allowRoles(2),ctrl.updateUser);
router.put('/users/:id/toggle-assignment', authMiddleware,allowRoles(2),ctrl.toggleAssignment);


router.post('/workflow/create', authMiddleware, ctrl.createWorkflow);
router.get('/workflow/list', authMiddleware, ctrl.listWorkflows);
router.put('/workflow/:id/set-default',authMiddleware,  ctrl.setDefaultWorkflow);


router.post('/leads/create', authMiddleware, ctrl.createLead);
router.post('/leads/public-create', ctrl.publicCreateLead);
router.get('/leads/list', authMiddleware, ctrl.listLeads);
router.put('/leads/:id/change-status', authMiddleware, ctrl.changeStatus);
router.put('/leads/:id/assign', authMiddleware, ctrl.assignLead);
router.put('/leads/:id/convert', authMiddleware, ctrl.convertLead);
router.put('/leads/:id/lost', authMiddleware, ctrl.lostLead);


router.post('/tasks/create', authMiddleware, ctrl.createTask);
router.get('/tasks/my-tasks', authMiddleware, ctrl.myTasks);
router.get('/tasks/today', authMiddleware, ctrl.todayTasks);
router.put('/tasks/:id/complete', authMiddleware, ctrl.completeTask);
router.get('/tasks/overdue', authMiddleware, ctrl.overdueTasks);


router.get('/analytics/lead-conversion', authMiddleware, ctrl.leadConversion);
router.get('/analytics/weekly-comparison', authMiddleware, ctrl.weeklyComparison);
router.get('/analytics/source-wise', authMiddleware, ctrl.sourceWise);
router.get('/analytics/status-wise', authMiddleware, ctrl.statusWise);
router.get('/analytics/user-performance', authMiddleware, ctrl.userPerformance);
router.get('/analytics/avg-conversion-time', authMiddleware, ctrl.avgConversionTime);

module.exports = router;