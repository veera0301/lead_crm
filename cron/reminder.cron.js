const cron = require('node-cron');
const db = require('../db');
const sendMail = require('../utils/sendmails');

cron.schedule('* */9 * * *', async () => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        t.title,
        u.email
      FROM lcrm_t_tasks t
      JOIN lcrm_t_lead l ON l.tid = t.lead_id
      JOIN lcrm_t_users u ON u.tid = l.assigned_to
      WHERE t.reminder_datetime <= NOW()
        AND t.status = 'Pending'
    `);

    for (const row of rows) {
      await sendMail(
        row.email,
        'Task Reminder',
        `Reminder for task: ${row.title}`
      );
    }

  } catch (err) {
    console.error('Reminder Cron Error:', err.message);
  }
});