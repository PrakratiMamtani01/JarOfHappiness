import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const User = mongoose.model('User');

const startAuthenticatedSession = (req, user) => {
    return new Promise((fulfill, reject) => {
        req.session.regenerate((err) => {
            if (!err) {
                req.session.user = user;
                fulfill(user);
            } else {
                reject(err);
            }
        });
    });
};


const endAuthenticatedSession = req => {
    return new Promise((fulfill, reject) => {
        req.session.destroy(err => err ? reject(err) : fulfill(null));
    });
};

const register = async (username, password, category) => {

    // * check if username and password are both greater than 8
    if (username.length <= 8 || password.length <= 8) {
        throw { message: 'USERNAME PASSWORD TOO SHORT' };
    }

    // * check if user with same username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        throw { message: 'USERNAME ALREADY EXISTS' };
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    if (category.length == 0) {
        throw { message: 'Category not selected' }
    }

    // get all items from database that are of selected category
    const jarItemsArray = await mongoose.model('Item').find({
        category: { $in: category }, // match any of the user's categories
        owner: { $in: ['public'] }
    }).exec();

    const jarItemsStatus = {}
    jarItemsArray.forEach((item) => {
        jarItemsStatus[item.itemId] = false; // maintain status of whether this item was chosen
    })

    const newUser = new User({
        username,
        password: hashedPassword,
        lastOpened: null,
        categoryPreferences: category,
        jarItems: jarItemsStatus,
    });

    // * save the user in database
    await newUser.save();
    return newUser;

};

const login = async (username, password) => {

    // * find a user with a matching username
    const foundUser = await User.findOne({ username });
    if (!foundUser) {
        // * username isn't found
        throw { message: "USER NOT FOUND" };
    }

    const passwordMatch = bcrypt.compareSync(password, foundUser.password);

    if (!passwordMatch) {
        // * passwords mismatch
        throw { message: "PASSWORDS DO NOT MATCH" };
    }

    // * however, if passwords match, return found user
    return foundUser;
};


export {
    startAuthenticatedSession,
    endAuthenticatedSession,
    register,
    login
};

