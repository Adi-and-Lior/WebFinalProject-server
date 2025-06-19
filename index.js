const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); 

const app = express();
const PORT = process.env.PORT || 3000;

const users = require(path.join(__dirname, 'users.json')); 

app.use(cors());
app.use(express.json());

app.post('/login', async (req, res) => {
    const { username, password, userType } = req.body;

    const foundUser = users.find(user =>
        user.username === username &&
        user.type === userType
    );

    if (foundUser) {
        try {
            const passwordMatch = await bcrypt.compare(password, foundUser.password);

            if (passwordMatch) {
                console.log('Login successful.'); 
                res.status(200).json({ user: { username: foundUser.username, type: foundUser.type } });
            } else {
                console.log('Login failed.'); 
                res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
            }
        } catch (err) {
            console.error('Error comparing password:', err); 
            res.status(500).json({ error: 'שגיאת שרת פנימית.' });
        }
    } else {
        console.log('Login failed.'); 
        res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }
});

app.get('/users', (req, res) => {
    const publicUsers = users.map(user => ({ username: user.username, type: user.type }));
    res.json(publicUsers);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
