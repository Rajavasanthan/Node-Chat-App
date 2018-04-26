const mongoose = require('mongoose');
const RoomSchema = mongoose.Schema({
    roomName: {
        type: String,
        required: [true, "Please Enter a Rooms Name"]
    },
    roomDisplayName: {
        type: String,
        required: [true, "Please Enter a Rooms Name"]
    },
    users : {
        type : [{
            type : mongoose.Schema.Types.ObjectId,
            ref : 'user'
        }]
    }
});

var Room = mongoose.model('room', RoomSchema);

module.exports = { Room };