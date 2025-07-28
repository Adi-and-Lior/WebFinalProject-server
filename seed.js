const mongoose = require('mongoose');
const FaultStatus = require('./models/FaultStatus');

mongoose.connect('mongodb+srv://adidisimon:8LVQHMcGWxnyz4h4@cluster0.pl0lwzl.mongodb.net/FinalProjectWeb?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');

    const statuses = [
      { value: 'in-progress', name: 'בטיפול' },
      { value: 'completed',   name: 'הושלם' },
      { value: 'rejected',    name: 'נדחה' },
    ];

    for (const status of statuses) {
      // יצירת הרשומה רק אם לא קיימת כבר
      const exists = await FaultStatus.findOne({ value: status.value });
      if (!exists) {
        await new FaultStatus(status).save();
        console.log(`Added status: ${status.name}`);
      }
    }

    console.log('Done seeding statuses.');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });
