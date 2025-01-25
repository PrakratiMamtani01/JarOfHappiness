import './config.mjs';
import './db.mjs';
import * as auth from './auth.mjs';
import * as spotify from './spotify.mjs';
import * as quotes from './quotes.mjs';

import mongoose from 'mongoose';
import sanitize from 'mongo-sanitize';

import express from 'express';
import session from 'express-session';

import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set('view engine', 'hbs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
}));

const Item = mongoose.model('Item');

app.use((req, res, next) => {
    console.log(req.path.toUpperCase(), req.body);
    next();
});

// middleware to ensure certain routes are only accessed if the user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        // Usr is authenticated, move ahead
        return next();
    } else {
        // User is not authenticated, redirect to login page
        res.redirect('/');
    }
}

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const user = await auth.login(
            sanitize(req.body.username),
            req.body.password
        );
        await auth.startAuthenticatedSession(req, user);
        res.redirect('home');
    } catch (err) {
        console.log(err);
        res.render('login', { message: err.message });
    }
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const selectedCategories = req.body.category || [];
        const newUser = await auth.register(
            sanitize(req.body.username),
            req.body.password,
            selectedCategories,
        );
        await auth.startAuthenticatedSession(req, newUser);
        res.redirect('/home');
    } catch (err) {
        console.log(err);
        res.render('register', { message: err.message });
    }
});

app.get('/home', ensureAuthenticated, async (req, res) => {
    const now = new Date();
    const lastOpened = req.session.user?.lastOpened;

    // check if it has been 24 hrs since last Opened
    if (lastOpened && now - new Date(lastOpened) < 24 * 60 * 60 * 1000) {
        res.render('home', {
            user: req.session.user,
            timer: 1,
        });
    } else {
        res.render('home', { user: req.session.user });
    }

});

app.post('/home', async (req, res) => {

    // validate that the form was submitted with a mood
    if (!req.body.mood || !req.body.mood.trim()) {
        return res.render('home', { user: req.session.user, message: "Mood is required to proceed." });
    }

    const now = new Date();

    const mood = req.body.mood.trim();
    const userCategories = req.session.user.categoryPreferences; // this is an array
    const jarItems = req.session.user.jarItems;
    let moodArray = [];

    // define mood-specific categories
    if (mood === 'excited') {
        moodArray = ['party', 'pop', 'excited'];
    }
    if (mood === 'angry') {
        moodArray = ['edm', 'anger'];
    }
    if (mood === 'stressed') {
        moodArray = ['focus', 'workout'];
    }
    if (mood === 'happy') {
        moodArray = ['mood', 'travel', 'happy'];
    }


    // Find all items in the database that match the user's categories and mood
    const findItems = async () => {
        return await mongoose.model('Item').find({
            category: { $in: userCategories },
            mood: { $in: moodArray },
            owner: { $in: ['public', req.session.user.username] }
        }).exec();
    };

    const itemsArray = await findItems();

    // Filter items to include only those that haven't been chosen
    let validItems = itemsArray.filter(
        (item) => Object.prototype.hasOwnProperty.call(jarItems, item.itemId) && jarItems[item.itemId] === false
    );

    if (validItems.length === 0) {
        Object.keys(jarItems).forEach((id) => {
            jarItems[id] = false;
        });
        validItems = itemsArray.filter(
            (item) => Object.prototype.hasOwnProperty.call(jarItems, item.itemId) && jarItems[item.itemId] === false
        );
    }

    // randomly select one item
    const randomIndex = Math.floor(Math.random() * validItems.length);
    const item = validItems[randomIndex];

    // Mark the selected item as chosen
    jarItems[item.itemId] = true;

    // commit changes to the database
    await mongoose.model('User').findByIdAndUpdate(
        req.session.user._id,
        {
            $set: {
                jarItems,
                lastOpened: now
            }
        }
    );

    req.session.user.jarItems = jarItems;
    req.session.user.lastOpened = now;
    res.render('home', { user: req.session.user, item: item, timer: 1 });
});

// implementing ajax to transfer information from server to javascript
app.get('/api/user-data', async (req, res) => {
    try {
        const userId = req.session.user._id; // get user id

        const user = await mongoose.model('User').findById(userId); // get user by id

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Send user data as a JSON response
        res.json({
            lastSubmission: user.lastOpened,
            categoryPreferences: user.categoryPreferences,
            jarItems: user.jarItems
        });
    } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).json({ error: "Failed to retrieve user data." });
    }
});

app.get('/home/add', ensureAuthenticated, (req, res) => {
    res.render('add-item', { user: req.session.user });

});

app.post('/home/add', async (req, res) => {
    if (!req.body.content || !req.body.author) {
        return res.render('add-item', { user: req.session.user, message: "Please add an item to add" });
    }

    // read form data
    const content = req.body.content.trim();
    const author = req.body.author.trim();
    const category = req.body.category.trim();
    const mood = req.body.mood.trim();

    // create new item to add
    const newItem = new Item({
        itemId: Math.floor(Math.random() * 100000),
        mood: mood,
        category: category,
        content: content,
        author: author || "Unknown Artist",
        owner: req.session.user.username
    });

    try {
        await newItem.save(); // Save to database
        console.log(`Saved: ${newItem.content} by ${newItem.author}`);
        req.session.user.jarItems[newItem.itemId] = false;
        await mongoose.model('User').findByIdAndUpdate(
            req.session.user._id,
            {
                $set: { jarItems: req.session.user.jarItems },
            }
        );
    } catch (error) {
        console.error(`Error saving song "${content}":`, error.message);
    }

    // if the user adds an item of category which they initially did not include in their preferences then update their preferences
    if (!req.session.user.categoryPreferences.includes(category)) {
        console.log('here');
        req.session.user.categoryPreferences.push(category);
        // update preferences in database
        await mongoose.model('User').findByIdAndUpdate(
            req.session.user._id,
            {
                $push: { categoryPreferences: category },
            }
        );
    }

    res.redirect('/home');

});

app.listen(process.env.PORT ?? 3000);
console.log('listening on port');

export { app };

// populate Items database
// eslint-disable-next-line no-unused-vars
function initialise() {
    spotify.populate();
    quotes.populate();
}

// if you are running the program for the first time uncomment this
// initialise()
