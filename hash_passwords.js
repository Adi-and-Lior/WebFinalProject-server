const bcrypt = require('bcrypt');
const saltRounds = 10; // מספר הסיבובים. 10 הוא ערך טוב לברירת מחדל

async function hashAllPasswords() {
    const passwordsToHash = {
        adi: "123",
        lior: "456"
    };

    console.log("Hashing passwords...");
    for (const username in passwordsToHash) {
        const plainPassword = passwordsToHash[username];
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
        console.log(`Username: ${username}, Plain: ${plainPassword}, Hashed: ${hashedPassword}`);
    }
    console.log("Done. Copy these hashes into your users.json file.");
}

hashAllPasswords();