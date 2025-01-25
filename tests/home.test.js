import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { User, Item } from '../db.mjs';
import bcrypt from 'bcryptjs';

describe('Test A Jar of Happiness', () => {
    let browser;
    let page;
    let sessionCookie;

    beforeAll(async () => {
        // Launch Puppeteer browser and page
        browser = await puppeteer.launch({ headless: false });
        page = await browser.newPage();

        // Connect to MongoDB
        await mongoose.connect(process.env.DSN);

        // Ensure the test user exists with a consistent state
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync('testpassword', salt);

        await mongoose.model('User').updateOne(
            { username: 'TestUser' },
            {
                username: 'TestUser',
                password: hashedPassword,
                categoryPreferences: ['quote'],
                jarItems: { "11959": false, "59754": false },
                lastOpened: null,
            },
            { upsert: true } // Create the user if it doesn't exist
        );

        // Login to get a valid session cookie
        await page.goto('http://localhost:3000/login');
        await page.type('input[name="username"]', 'TestUser');
        await page.type('input[name="password"]', 'testpassword');
        await page.click('input[type="submit"]');
        await page.waitForNavigation();

        // Get the session cookie
        const cookies = await page.cookies();
        sessionCookie = cookies.find(cookie => cookie.name === 'connect.sid');
    });

    afterAll(async () => {
        // Clean up and close Puppeteer and MongoDB connections
        await mongoose.disconnect();
        await browser.close();
    });

    beforeEach(async () => {
        // Reset the test user's state before each test
        await mongoose.model('User').updateOne(
            { username: 'TestUser' },
            {
                $set: {
                    categoryPreferences: ['quote'],
                    jarItems: { "11959": false, "59754": false },
                    lastOpened: null,
                },
            }
        );
    });

    // TEST 1: Check that once a message is displayed, its status is set to true
    test('Check if message state gets updated', async () => {
        // Navigate to the page with the form
        await page.goto('http://localhost:3000/home');

        // Fetch the initial status of jarItems
        let user = await mongoose.model('User').findOne({ username: 'TestUser' });
        const prevValueItem1 = user.jarItems.get('11959');
        const prevValueItem2 = user.jarItems.get('59754');

        // Fill out the form fields
        await page.click('input[id="happy"]');

        // Submit the form
        await page.click('input[type="submit"]');

        // Check a note is visible
        await page.waitForSelector('#note', { visible: true });

        // Fetch the updated user data
        user = await mongoose.model('User').findOne({ username: 'TestUser' });

        // Validate the jarItems status
        if (user.jarItems.get('11959') !== prevValueItem1) {
            expect(user.jarItems.get('11959')).toBe(!prevValueItem1); // Check status updated
            expect(user.jarItems.get('59754')).toBe(prevValueItem2); // Check status unchanged
        } else if (user.jarItems.get('59754') !== prevValueItem2) {
            expect(user.jarItems.get('59754')).toBe(!prevValueItem2); // Check status updated
            expect(user.jarItems.get('11959')).toBe(prevValueItem1); // Check status unchanged
        } else {
            throw new Error('No jar item was updated.');
        }
    });

    // TEST 2: Check if the page reloads after the timer
    test('Check End Timer', async () => {

        // Navigate to the page
        await page.goto('http://localhost:3000/home');

        // When the form become available it means the timer has now ended.
        await page.waitForSelector('.open-jar-form');

        const inputVisible = await page.waitForSelector('input[id="happy"]', { visible: true });
        expect(inputVisible).toBeTruthy();
    });

    // TEST 3: Check that a new item is added into the user's personalised jarItems
    test('Check Add Item', async () => {
        // Navigate to the page with the form
        await page.goto('http://localhost:3000/home/add');

        // Fill out the form fields
        await page.type("input[name='content']", 'New Jar Item');
        await page.type("input[name='author']", 'John Doe');
        await page.select('#category', 'quote');
        await page.select('#mood', 'happy');

        // Submit the form
        await page.click('input[type="submit"]');

        // Wait for the page to process the form submission
        await page.waitForNavigation();

        // Fetch the updated user data
        const newItem = await mongoose.model('Item').findOne({ content: 'New Jar Item' });
        expect(newItem.content).toBe('New Jar Item');
        expect(newItem.author).toBe('John Doe');
        expect(newItem.category).toBe('quote');
        expect(newItem.mood).toBe('happy');
    });

    // TEST 4: Check that category preferences are updated when a new category is added
    test('Check Updated Category Preferences', async () => {
        // Navigate to the page with the form
        await page.goto('http://localhost:3000/home/add');

        let user = await mongoose.model('User').findOne({ username: 'TestUser' });

        // Fill out the form fields
        await page.type("input[name='content']", 'New Song Item');
        await page.type("input[name='author']", 'Sample Artist');
        await page.select('#category', 'song');
        await page.select('#mood', 'angry');

        // Submit the form
        await page.click('input[type="submit"]');

        // Wait for the page to process the form submission
        await page.waitForNavigation();

        // Fetch the updated user data
        user = await mongoose.model('User').findOne({ username: 'TestUser' });

        expect(user.categoryPreferences).toContain('song');
    });
});
