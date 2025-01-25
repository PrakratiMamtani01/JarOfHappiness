// this javaScript file is to parse the codes data into database

import mongoose from 'mongoose';
import fs from 'fs';


const Item = mongoose.model('Item');

export async function populate() {
    const quotes = JSON.parse(fs.readFileSync('quotes.json', 'utf-8'));

    const quoteItems = quotes.map((item, index) => ({
        itemId: Math.floor(Math.random() * 100000), // Generate a unique ID based on the index
        mood: item.mood,
        category: 'quote', // Assuming the category is "quote" for all
        content: item.quote,
        author: item.author,
        owner: 'public'
    }));

    await Item.insertMany(quoteItems);
    console.log('Quotes successfully imported to database.');
}