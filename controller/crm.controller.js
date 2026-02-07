const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/sendmails');

//COMPANY REGISTER
exports.registerCompany = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const {
      company_name,
      company_code,
      email,
      phone,
      industry,
      subscription_plan,
      max_users,
      admin_name,
      admin_email,
      password
    } = req.body;

    if (!company_name || !company_code || !admin_email || !password) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await conn.beginTransaction();

    const [company] = await conn.execute(
      `INSERT INTO lcrm_t_companies
       (company_name, company_code, email, phone, industry, subscription_plan, max_users)
       VALUES (?,?,?,?,?,?,?)`,
      [
        company_name,
        company_code,
        email,
        phone,
        industry,
        subscription_plan || 'free',
        max_users || 5
      ]
    );

    const hashed = await bcrypt.hash(password, 10);

    await conn.execute(
      `INSERT INTO lcrm_t_users
       (company_id, role_id, first_name, email, password)
       VALUES (?,?,?,?,?)`,
      [company.insertId, 2, admin_name || 'Admin', admin_email, hashed]
    );

    await conn.commit();
    res.status(201).json({ message: 'Company registered successfully' });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

// LOGIN
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const [users] = await db.execute(
    'SELECT * FROM lcrm_t_users WHERE email=?',
    [email]
  );

  if (!users.length) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const user = users[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      user_id: user.tid,
      role_id: user.role_id,
      company_id: user.company_id
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({ message: 'Login successful', token });
};

// LOGOUT
exports.logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

//FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const [users] = await db.execute(
      'SELECT tid, email, first_name FROM lcrm_t_users WHERE email=?',
      [email]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    //  JWT reset token
    const token = jwt.sign(
      { user_id: user.tid, purpose: 'RESET_PASSWORD' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password/${token}`;

    //  SEND MAIL
    await sendMail(
      user.email,
      'Reset Your Password',
      `
        <h3>Hello ${user.first_name}</h3>
        <p>Click below link to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Valid for 15 minutes</p>
      `
    );

    res.json({ message: 'Password reset mail sent successfully' });

  } catch (err) {
    console.error('MAIL ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};
// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'RESET_PASSWORD') {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const hashed = await bcrypt.hash(new_password, 10);

    await db.execute(
      'UPDATE lcrm_t_users SET password=? WHERE tid=?',
      [hashed, decoded.user_id]
    );

    res.json({ message: 'Password reset successful' });

  } catch {
    res.status(401).json({ message: 'Token expired or invalid' });
  }
};


// CREATE USER

exports.createUser = async (req, res) => {
  try {
    const { first_name, email, password, role_id, manager_id } = req.body;
    const company_id = req.user.company_id;

    if (!first_name || !email || !password || !role_id) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      `INSERT INTO lcrm_t_users
       (company_id, role_id, first_name, email, password, manager_id)
       VALUES (?,?,?,?,?,?)`,
      [company_id, role_id, first_name, email, hashedPassword, manager_id || null]
    );

    res.status(201).json({ message: 'User created successfully' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//LIST USERS


exports.listUsers = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const [users] = await db.execute(
      `SELECT tid, first_name, email, role_id,
              is_available_for_assignment
       FROM lcrm_t_users
       WHERE company_id=?`,
      [company_id]
    );

    res.json(users);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE USER
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, role_id, manager_id } = req.body;
    const company_id = req.user.company_id;

    await db.execute(
      `UPDATE lcrm_t_users
       SET first_name=?, role_id=?, manager_id=?
       WHERE tid=? AND company_id=?`,
      [first_name, role_id, manager_id, id, company_id]
    );

    res.json({ message: 'User updated successfully' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// TOGGLE ROUND ROBIN
exports.toggleAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    await db.execute(
      `UPDATE lcrm_t_users
       SET is_available_for_assignment =
           IF(is_available_for_assignment=1,0,1)
       WHERE tid=? AND company_id=?`,
      [id, company_id]
    );

    res.json({ message: 'Assignment status toggled' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};




//CREATE WORKFLOW WITH STAGES


exports.createWorkflow = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { workflow_name, stages, is_default } = req.body;
    const { company_id } = req.user;

    if (!workflow_name || !Array.isArray(stages) || !stages.length) {
      return res.status(400).json({ message: 'Workflow name & stages required' });
    }

    await conn.beginTransaction();

    // if default unset previous default
    if (is_default) {
      await conn.execute(
        `UPDATE lcrm_t_workflows SET is_default=0 WHERE company_id=?`,
        [company_id]
      );
    }

    // create workflow
    const [wf] = await conn.execute(
      `INSERT INTO lcrm_t_workflows (company_id, workflow_name, is_default)
       VALUES (?,?,?)`,
      [company_id, workflow_name, is_default ? 1 : 0]
    );

    const workflowId = wf.insertId;

    // insert stages
    for (let i = 0; i < stages.length; i++) {
      await conn.execute(
        `INSERT INTO lcrm_t_workflows_stages
         (workflow_id, lead_status_id, stage_order)
         VALUES (?,?,?)`,
        [workflowId, stages[i], i + 1]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: 'Workflow created successfully',
      workflow_id: workflowId
    });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};


// LIST WORKFLOWS
exports.listWorkflows = async (req, res) => {
  try {
    const { company_id } = req.user;

    const [workflows] = await db.execute(
      `SELECT * FROM lcrm_t_workflows WHERE company_id=?`,
      [company_id]
    );

    res.json(workflows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SET DEFAULT WORKFLOW

exports.setDefaultWorkflow = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { company_id } = req.user;

    await conn.beginTransaction();

    // unset existing default
    await conn.execute(
      `UPDATE lcrm_t_workflows SET is_default=0 WHERE company_id=?`,
      [company_id]
    );

    // set new default
    await conn.execute(
      `UPDATE lcrm_t_workflows SET is_default=1 WHERE tid=? AND company_id=?`,
      [id, company_id]
    );

    await conn.commit();

    res.json({ message: 'Default workflow updated' });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};



//ROUND ROBIN USER
async function getRoundRobinUser(companyId) {
  const [users] = await db.execute(
    `SELECT tid FROM lcrm_t_users
     WHERE company_id=? AND role_id=4 AND is_available_for_assignment=1
     ORDER BY tid`,
    [companyId]
  );

  if (!users.length) return null;

  const [tracker] = await db.execute(
    `SELECT last_assigned_user_id
     FROM lcrm_t_round_robin_tracker
     WHERE company_id=?`,
    [companyId]
  );

  let assignedUserId;

  if (!tracker.length || !tracker[0].last_assigned_user_id) {
    assignedUserId = users[0].tid;
  } else {
    const index = users.findIndex(
      u => u.tid === tracker[0].last_assigned_user_id
    );
    assignedUserId = users[(index + 1) % users.length].tid;
  }

  await db.execute(
    `INSERT INTO lcrm_t_round_robin_tracker
     (company_id, last_assigned_user_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_assigned_user_id=?`,
    [companyId, assignedUserId, assignedUserId]
  );

  return assignedUserId;
}


  //CREATE LEAD (MANUAL)

exports.createLead = async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone,
      source_id, expected_value
    } = req.body;

    const leadCode = `LEAD-${Date.now()}`;

    await db.execute(
      `INSERT INTO lcrm_t_lead
      (company_id, lead_code, first_name, last_name, email, phone, source_id, expected_value)
      VALUES (?,?,?,?,?,?,?,?)`,
      [
        req.user.company_id,
        leadCode,
        first_name,
        last_name,
        email,
        phone,
        source_id,
        expected_value || 0
      ]
    );

    res.status(201).json({ message: 'Lead created successfully' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//PUBLIC CREATE
exports.publicCreateLead = async (req, res) => {
  try {
    const {
      company_id,
      first_name, last_name, email, phone,
      source_id, expected_value
    } = req.body;

    const assignedUserId = await getRoundRobinUser(company_id);
    if (!assignedUserId) {
      return res.status(400).json({ message: 'No sales rep available' });
    }

    const leadCode = `LEAD-${Date.now()}`;

    await db.execute(
      `INSERT INTO lcrm_t_lead
      (company_id, lead_code, first_name, last_name, email, phone, source_id, expected_value, assigned_to)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        company_id,
        leadCode,
        first_name,
        last_name,
        email,
        phone,
        source_id,
        expected_value || 0,
        assignedUserId
      ]
    );

    res.status(201).json({
      message: 'Lead created & auto-assigned',
      assigned_to: assignedUserId
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// LIST LEADS
exports.listLeads = async (req, res) => {
  const [leads] = await db.execute(
    `SELECT * FROM lcrm_t_lead WHERE company_id=?`,
    [req.user.company_id]
  );
  res.json(leads);
};

// CHANGE STATUS

exports.changeStatus = async (req, res) => {
  const { id } = req.params;
  const { status_id } = req.body;

  await db.execute(
    `UPDATE lcrm_t_lead SET current_status_id=? WHERE tid=?`,
    [status_id, id]
  );

  res.json({ message: 'Lead status updated' });
};

// MANUAL ASSIGN

exports.assignLead = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  await db.execute(
    `UPDATE lcrm_t_lead SET assigned_to=? WHERE tid=?`,
    [user_id, id]
  );

  res.json({ message: 'Lead assigned manually' });
};


//CONVERT (WON)

exports.convertLead = async (req, res) => {
  const { id } = req.params;

  await db.execute(
    `UPDATE lcrm_t_lead SET is_converted=1 WHERE tid=?`,
    [id]
  );

  res.json({ message: 'Lead marked as WON' });
};


   // LOST

exports.lostLead = async (req, res) => {
  const { id } = req.params;

  await db.execute(
    `UPDATE lcrm_t_lead SET is_converted=0 WHERE tid=?`,
    [id]
  );

  res.json({ message: 'Lead marked as LOST' });
};




// CREATE TASK
exports.createTask = async (req, res) => {
  try {
    const {
      lead_id,
      task_type_id,
      title,
      due_date,
      due_time,
      priority
    } = req.body;

    const userId = req.user.user_id;

    if (!lead_id || !task_type_id || !title || !due_date) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await db.execute(
      `INSERT INTO lcrm_t_tasks
       (lead_id, task_type_id, title, due_date, due_time, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        lead_id,
        task_type_id,
        title,
        due_date,
        due_time || null,
        priority || 'Medium',
        'Pending'
      ]
    );

    res.json({ message: 'Task created successfully' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// MY TASKS
exports.myTasks = async (req, res) => {
  try {
    const userId = req.user.user_id; 

    const [tasks] = await db.execute(
      `SELECT
        t.tid,
        t.title,
        t.due_date,
        t.due_time,
        t.priority,
        t.status,
        l.first_name AS lead_first_name,
        l.last_name AS lead_last_name
      FROM lcrm_t_tasks t
      JOIN lcrm_t_lead l ON t.lead_id = l.tid
      WHERE l.assigned_to 
      ORDER BY t.due_date ASC`,
      [userId]
    );

    res.json(tasks);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// TODAY TASKS
exports.todayTasks = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [tasks] = await db.execute(
      `SELECT t.*
       FROM lcrm_t_tasks t
       JOIN lcrm_t_lead l ON l.tid = t.lead_id
       WHERE l.assigned_to = ?
       AND t.due_date = CURDATE()
       AND t.status = 'Pending'`,
      [userId]
    );

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// COMPLETE TASK
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute(
      `UPDATE lcrm_t_tasks
       SET status = 'Completed'
       WHERE tid = ?`,
      [id]
    );

    res.json({ message: 'Task marked as completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// OVERDUE TASKS
exports.overdueTasks = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [tasks] = await db.execute(
      `SELECT t.*
       FROM lcrm_t_tasks t
       JOIN lcrm_t_lead l ON l.tid = t.lead_id
       WHERE l.assigned_to = ?
       AND t.due_date < CURDATE()
       AND t.status = 'Pending'`,
      [userId]
    );

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//   1. Lead Conversion 

exports.leadConversion = async (req, res) => {
  try {
    const companyId = req.user.company_id;

  
    const [[total]] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM lcrm_t_lead 
       WHERE company_id=?`,
      [companyId]
    );

   
    const [[won]] = await db.execute(
      `SELECT COUNT(*) AS won 
       FROM lcrm_t_lead 
       WHERE company_id=? AND is_converted=1`,
      [companyId]
    );

    const percentage =
      total.total === 0
        ? 0
        : ((won.won / total.total) * 100).toFixed(2);

    res.json({
      total_leads: total.total,
      won_leads: won.won,
      conversion_percentage: Number(percentage)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//   2. Weekly Comparison

exports.weeklyComparison = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await db.execute(
      `
      SELECT 
        YEARWEEK(created_at) AS week,
        COUNT(*) AS leads
      FROM lcrm_t_lead
      WHERE company_id=?
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
      GROUP BY YEARWEEK(created_at)
      ORDER BY week
      `,
      [companyId]
    );

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//   3. Source Wise Leads

exports.sourceWise = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await db.execute(
      `
      SELECT 
        src.source_name AS source,
        COUNT(l.tid) AS count
      FROM lcrm_t_lead l
      JOIN lcrm_m_lead_source src ON src.tid = l.source_id
      WHERE l.company_id=?
      GROUP BY src.source_name
      `,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//   4. Status Wise Leads

exports.statusWise = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await db.execute(
      `
      SELECT 
        st.status_name AS status,
        COUNT(l.tid) AS count
      FROM lcrm_t_lead l
      JOIN lcrm_m_lead_status st ON st.tid = l.current_status_id
      WHERE l.company_id=?
      GROUP BY st.status_name
      `,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//   5. User Performance

exports.userPerformance = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await db.execute(
      `
      SELECT 
        u.first_name AS user,
        COUNT(l.tid) AS assigned,
        SUM(CASE WHEN st.status_code='WON' THEN 1 ELSE 0 END) AS won
      FROM lcrm_t_users u
      LEFT JOIN lcrm_t_lead l ON l.assigned_to = u.tid
      LEFT JOIN lcrm_m_lead_status st ON st.tid = l.status_id
      WHERE u.company_id=?
      GROUP BY u.tid
      `,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//   6. Avg Conversion Time

exports.avgConversionTime = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await db.execute(
      `
      SELECT 
        AVG(DATEDIFF(won_date, created_date)) AS avg_days
      FROM (
        SELECT 
          l.tid AS lead_id,
          MIN(h.changed_at) AS created_date,
          MAX(
            CASE WHEN l.is_converted = 1 THEN h.changed_at END
          ) AS won_date
        FROM lcrm_t_lead l
        JOIN lcrm_t_lead_history h ON h.lead_id = l.tid
        WHERE l.company_id=?
        GROUP BY l.tid
        HAVING won_date IS NOT NULL
      ) 
      `,
      [companyId]
    );

    res.json({
      average_conversion_days: rows[0].avg_days
        ? Number(rows[0].avg_days.toFixed(2))
        : 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};