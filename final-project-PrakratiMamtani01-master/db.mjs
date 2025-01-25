import mongoose from 'mongoose';
import mongooseSlugPlugin from 'mongoose-slug-plugin';
import dotenv from 'dotenv';

dotenv.config();


mongoose.connect(process.env.DSN);

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    lastOpened: { type: Date, default: null },
    categoryPreferences: [{ type: String }],
    jarItems: {
        type: Map,
        of: Boolean,
        default: {},
    },
});

const ItemSchema = new mongoose.Schema({
    itemId: { type: Number, required: true, unique: true },
    mood: { type: String, required: true }, // mood
    category: { type: String, required: true }, // song or quote
    content: { type: String, required: true },
    author: { type: String, required: true },
    owner: { type: String, required: true } // records who owns the record
});

UserSchema.plugin(mongooseSlugPlugin, { tmpl: '<%=username%>' });
ItemSchema.plugin(mongooseSlugPlugin, { tmpl: '<%=content%>' });

const User = mongoose.model('User', UserSchema);
const Item = mongoose.model('Item', ItemSchema);

export { User, Item };