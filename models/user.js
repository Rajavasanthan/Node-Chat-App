const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
    
    fullName: {
        type: String
    },
    email: {
        type: String
    },
    status : {
        type : String
    },
    userImage: {
        type: String,
        default: 'default.png'
    },
    facebook: {
        type: String,
        default: ''
    },
    fbTokens: Array,
    sentRequest : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'user'
        }
    ],
    friendRequest : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'user'
        }
    ],
    friends : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'user'
        }
    ],
    socketId : {
        type : String
    },
    currentFriend : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'user'
    }
});

var User = mongoose.model('user', UserSchema);

module.exports = { User };