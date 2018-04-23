const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({

    fullName: {
        type: String
    },
    email: {
        type: String,
        required: true,
        unique: [true, 'Email already exist'],
    },
    status: {
        type: String
    },
    password: {
        type: String,
    },
    userImage: {
        type: String,
        default: 'https://www.timeshighereducation.com/sites/default/files/byline_photos/default-avatar.png'
    },
    facebook: {
        type: String,
        default: ''
    },
    fbTokens: Array,
    sentRequest: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    friendRequest: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    socketId: {
        type: String
    },
    currentFriend: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    room: {
        name: {
            type: String
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'room'
        }
    }
});

var User = mongoose.model('user', UserSchema);

module.exports = { User };