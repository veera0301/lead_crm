require('dotenv').config();
require('./cron/reminder.cron');
const express = require('express');
const app = express();       

app.use(express.json());

app.use('/', require('./routes/crm.routes'));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});