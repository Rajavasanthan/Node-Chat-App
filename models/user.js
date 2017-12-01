const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
    userName : {
        type : String,
        unique : true
    },
    fullName : {
        type : String,
        unique : true,
        default : ''
    },
    email : {
        type : String,
        unique : true
    },
    userImage : {
        type : String,
        default : 'default.png'
    },
    facebook : {
        type : String,
        default : ''
    },
    fbTokens : Array
});

var User = mongoose.model('user',UserSchema);

module.exports = { User };