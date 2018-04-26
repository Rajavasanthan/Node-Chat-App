const mongoose = require('mongoose');

const MessageSchema = mongoose.Schema({
    participents: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    message: {
        type: String,
        required: true
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    recivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    messageType : {
        type : String //room,personal
    },
    roomName : {
        type : String
    }
});

var Message = mongoose.model('message', MessageSchema);

module.exports = { Message };