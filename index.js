const express = require('express'); //
const socketIO = require('socket.io'); //
const app = express(); //

const http = require('http'); //
const server = http.createServer(app); //
const io = socketIO(server); //
const session = require('express-session'); //
const MongoStore = require('connect-mongo')(session); //
const mongoose = require('mongoose'); //
const cookiParser = require('cookie-parser');
const passport = require('passport'); //
const FacebookStatergy = require('passport-facebook').Strategy; //
const LocalStrategy = require('passport-local').Strategy; //
const secret = require('./secret');
const bodyParser = require('body-parser');
const sharedSession = require('express-socket.io-session');

//Models
var { User } = require('./models/user'); //
var { Message } = require('./models/message');
var { Room } = require('./models/room');

mongoose.Promise = global.Promise; //
// mongoose.connect('mongodb://localhost/mydb');
mongoose.connect(secret.mongoUrl); //

app.use(express.static('public')); //
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('port', process.env.PORT || 3008);
app.set('view engine', 'ejs'); //

//
var chatSession = session({
    secret: 'fjdsffdsfafddsfdsf',
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
})
app.use(chatSession); //


io.use(sharedSession(chatSession, {
    autoSave: true
}));

io.on('connection', (socket) => {
    User.findByIdAndUpdate(socket.handshake.session.passport.user, { $set: { status: 'Online', socketId: socket.id } })
        .populate('friends')
        .populate('friendRequest')
        .then((user) => {

            // console.log(user.friends);
            io.to(socket.id).emit('userList', user.friends);
            io.to(socket.id).emit('newFriendRequest', user.friendRequest);
            console.log("User Logged In");
            user.friends.forEach(function (friend) {
                if (friend.socketId !== null) {
                    io.to(friend.socketId).emit('newMemberOnline', user);
                }
            }, this);
        })
        .catch((err) => {
            console.log(err);
        });

    //
    socket.on('newMessage', (message, callback) => {
        var newMessage = new Message({
            participents: [
                socket.handshake.session.passport.user,
                message.to
            ],
            message: message.message,
            sentBy: socket.handshake.session.passport.user,
            recivedBy: message.to,
            messageType: "personal"
        });

        newMessage.save()
            .then((savedMessage) => {
                return Message.populate(savedMessage,
                    [{
                        path: 'sentBy',
                        select: {
                            _id: 1,
                            userImage: 1
                        }
                    },
                    {
                        path: 'recivedBy',
                        select: {
                            _id: 1,
                            userImage: 1
                        }
                    }]
                ).then((populatedMessage) => {
                    return populatedMessage
                })
            })
            .then((populatedMessage) => {
                return User.findById(message.to)
                    .populate('currentFriend', { _id: 1, socketId: 1 })
                    .then((toUser) => {
                        return { toUser, populatedMessage };
                    })
            })
            .then((toUserWithPopulatedMessage) => {
                if (toUserWithPopulatedMessage.toUser.currentFriend) {
                    if (toUserWithPopulatedMessage.toUser.currentFriend._id == socket.handshake.session.passport.user) {
                        // console.log('Send Message');
                        io.to(toUserWithPopulatedMessage.toUser.socketId).emit('newMessageRecived', toUserWithPopulatedMessage.populatedMessage);
                    } else {
                        io.to(toUserWithPopulatedMessage.toUser.socketId).emit('updateUserList', toUserWithPopulatedMessage.populatedMessage);
                    }
                }
                callback(toUserWithPopulatedMessage.populatedMessage);
            })
            .catch((err) => {
                console.log(err);
            });
    });


    socket.on('newRoomMessage', (message, callback) => {
        var messageData = new Message({
            message: message.content,
            sentBy: socket.handshake.session.passport.user,
            messageType: "room",
            roomName: message.roomName
        });
        messageData.save()
            .then((savedMessage) => {
                User.findById(socket.handshake.session.passport.user).then((user) => {
                    socket.to(message.roomName).emit('newMessageInRoom', {
                        message: message.content,
                        roomName: message.roomName,
                        sentBy: {
                            fullName: user.fullName,
                            userImage: user.userImage
                        }
                    });
                    callback({
                        message: message.content,
                        roomName: message.roomName,
                        sentBy: {
                            fullName: user.fullName,
                            userImage: user.userImage
                        }
                    });
                });
            });
    });
    //
    app.get('/add_friend/:toId', isLoggedIn, (req, res) => {
        User.findById(req.user._id)
            .exec()
            .then((currentUser) => {
                currentUser.sentRequest.push(req.params.toId);
                currentUser.save();
            })
            .then(() => {
                return User.findById(req.params.toId)
                    .exec();
            })
            .then((toUser) => {
                // console.log(toUser);
                toUser.friendRequest.push(req.user._id);
                return toUser.save();
            })
            .then((toUser) => {
                return User.findById(req.params.toId)
                    .populate('friendRequest', { fullName: 1, _id: 1, userImage: 1, status: 1 })
                    .exec();
            })
            .then((toUser) => {
                // console.log(toUser);
                io.to(toUser.socketId).emit('newFriendRequest', toUser.friendRequest);
                res.json("success");
            })
            .catch((err) => {
                console.log(err);
            });
    });

    //
    app.get('/accept_friend/:friendId', (req, res) => {
        User.findByIdAndUpdate(req.user._id, {
            $pull: {
                friendRequest: req.params.friendId
            },
            $push: {
                friends: req.params.friendId
            }
        }).then((currentUserUpdated) => {
            return User.findByIdAndUpdate(req.params.friendId, {
                $pull: {
                    sentRequest: req.user._id
                },
                $push: {
                    friends: req.user._id
                }
            }).then((friendUserUpdated) => {
                return { currentUserUpdated, friendUserUpdated };
            });
        })
            .then((updatedResult) => {
                return User.findById(req.user._id)
                    .populate('friends')
                    .populate('friendRequest')
                    .then((currentUser) => {
                        return currentUser
                    });
            }).then((currentUser) => {
                return User.findById(req.params.friendId)
                    .populate('friends')
                    .populate('friendRequest')
                    .then((friendUser) => {
                        return { currentUser, friendUser }
                    });
            })
            .then((updatedResult) => {
                // console.log(updatedResult);
                io.to(updatedResult.currentUser.socketId).emit('userList', updatedResult.currentUser.friends);
                io.to(updatedResult.currentUser.socketId).emit('newFriendRequest', updatedResult.currentUser.friendRequest);

                io.to(updatedResult.friendUser.socketId).emit('userList', updatedResult.friendUser.friends);
                io.to(updatedResult.friendUser.socketId).emit('newFriendRequest', updatedResult.friendUser.friendRequest);
                res.json('Success');
            })
            .catch((err) => {
                console.log(err);
            });
    });

    //If this user is already in Some other room, Releave him from that room - socket.leave();
    // Remove this userId from the usersArray in Rooms collection
    // Remove the Room details from User Record
    // Inform to all users to that Room that he has left the room
    // Update the User list for all other users in that room

    //Make him to join in the requested room - socket.join(room.roomName);

    //Add his ID to users Array in Rooms collection
    //Set his roomId field to the requested room
    //Inform all Room mates that this user has joined
    //Populate all the user list in this room to connected user

    // app.get('/joinroom/:roomName', (req, res) => {

    // });

    socket.on('joinRoom', (room) => {
        Room.findOne({ roomName: room.roomName })
            .then((room) => {
                return room;
            }).then((room) => {
                return User.findById(socket.handshake.session.passport.user).then((user) => {
                    return { user, room };
                });
            })
            .then((roomAndUser) => {
                console.log(roomAndUser);
                if (roomAndUser.room) {
                    // If this user is already in Some other room, Releave him from that room - socket.leave();
                    console.log(roomAndUser.user.room);
                    if (roomAndUser.user.room.name !== undefined) {
                        console.log('Remove from ' + roomAndUser.user.room.name);
                        socket.leave(roomAndUser.user.room.name);

                        // Inform to all users to that Room that he has left the room
                        socket.to(roomAndUser.user.room.name).emit('userLeftMessageForRoomMembers', {
                            userName: roomAndUser.user.fullName,
                            messageType: 'left'
                        });
                        // Update the User list for all other users in that room
                        socket.to(roomAndUser.user.room.name).emit('userLeftRoomUpdateUserList', {
                            _id : socket.handshake.session.passport.user
                        });

                        // Remove this userId from the usersArray in Rooms collection
                        Room.findByIdAndUpdate(roomAndUser.user.room.id, { $pull: { users: socket.handshake.session.passport.user } }).then(() => {
                            // Remove the Room details from User Record
                            User.findByIdAndUpdate(roomAndUser.user._id, { $set: { room: undefined } }).then(() => {

                            });
                        });
                    }

                    //Make him to join in the requested room - socket.join(room.roomName);
                    console.log('Joined in ' + roomAndUser.room.roomName + ' Room');
                    socket.join(roomAndUser.room.roomName);

                    Room.findByIdAndUpdate(roomAndUser.room._id, { $push: { users: socket.handshake.session.passport.user } }).then(() => {
                        Room.findById(roomAndUser.room._id)
                            .populate({
                                path: 'users',
                                match: {
                                    _id: {
                                        $ne: socket.handshake.session.passport.user
                                    }
                                },
                                select: { _id: 1, fullName: 1, userImage: 1, status: 1 }
                            }) //'users',{_id : 1,fullName:1,userImage:1,status:1}
                            .exec()
                            .then((roomWithUsers) => {
                                console.log(roomWithUsers);
                                socket.emit('joinSuccess', {
                                    message: "You Joined in " + roomAndUser.room.roomName,
                                    roomUserList: roomWithUsers.users,
                                    roomName: roomAndUser.room.roomName,
                                    roomDisplayName: roomAndUser.room.roomDisplayName
                                });
                                //Set his roomId field to the requested room
                                User.findByIdAndUpdate(roomAndUser.user._id, { $set: { room: { name: room.roomName, id: roomAndUser.room._id } } })
                                    .then(() => {
                                        //Inform all Room mates that this user has joined
                                        socket.to(roomAndUser.room.roomName).emit('userJoinedMessageForRoomMembers', {
                                            userName: roomAndUser.user.fullName,
                                            messageType: 'join'
                                        });

                                        //Populate all the user list in this room to connected user
                                        console.log('---------');
                                        console.log(roomAndUser.user);
                                        socket.to(roomAndUser.room.roomName).emit('userJoinedRoomUpdateUserList', {
                                            _id : socket.handshake.session.passport.user,
                                            fullName: roomAndUser.user.fullName,
                                            status : roomAndUser.user.status,
                                            userImage : roomAndUser.user.userImage
                                        });
                                        // res.status(200).json({ message: "Joined" });
                                    });
                            });
                    });
                    // roomAndUser.room.users.push(req.user._id);




                } else {
                    res.status(404).json('Room not Found');
                }
            });
    })

    //
    app.get('/reject_friend/:rejectId', (req, res) => {
        User.findByIdAndUpdate(req.user._id, {
            $pull: {
                friendRequest: req.params.rejectId
            }
        }).then(() => {
            return User.findByIdAndUpdate(req.params.rejectId, {
                $pull: {
                    sentRequest: req.user._id
                }
            })
        })
            .then((updatedResult) => {
                return User.findById(req.user._id)
                    .populate('friends')
                    .populate('friendRequest')
                    .then((currentUser) => {
                        return currentUser
                    });
            }).then((currentUser) => {
                return User.findById(req.params.rejectId)
                    .populate('friends')
                    .populate('friendRequest')
                    .then((rejectUser) => {
                        return { currentUser, rejectUser }
                    });
            })
            .then((updatedResult) => {
                // console.log(updatedResult);
                io.to(updatedResult.currentUser.socketId).emit('rejectFriendRequest', req.params.rejectId);
                io.to(updatedResult.rejectUser.socketId).emit('rejectFriendRequest', req.user._id);
                res.json("success");
            })
            .catch((err) => {
                console.log(err);
            });
    });

    app.get('/get_msg_by_room_name/:roomName', (req, res) => {
        Message.find({
            $and: [
                {
                    messageType: "room",
                },
                {
                    roomName: req.params.roomName
                }
            ]
        })
            .populate('sentBy', { _id: 1, fullName: 1, userImage: 1 })
            .then((roomMessages) => {
                console.log(roomMessages);
                res.status(200).json(roomMessages);
            })
    });

    //
    app.get('/get_msg_by_friendid/:friendId', (req, res) => {
        Message.find({
            participents: {
                $all: [req.user._id, req.params.friendId]
            }
        })
            .populate('sentBy', { _id: 1, userImage: 1 })
            .populate('recivedBy', { _id: 1, userImage: 1 })
            .exec()
            .then((message) => {
                return User.findByIdAndUpdate(req.user._id, { $set: { currentFriend: req.params.friendId } }).then((currentUser) => {
                    return { message }
                });
            })
            .then((data) => {
                res.json(data.message);
            })
            .catch((err) => {
                console.log(err);
            });
    })

    //
    socket.on('disconnect', function () {
        User.findByIdAndUpdate(socket.handshake.session.passport.user, { $set: { status: 'Offline', socketId: null, room: undefined } })
            .populate('friends')
            .then((user) => {
                console.log("User Logged Out");
                user.friends.forEach(function (friend) {
                    if (friend.socketId !== null) {
                        io.to(friend.socketId).emit('newMemberOffline', user);
                    }
                }, this);
                return user;
            })
            .then((user) => {
                console.log(user);
                console.log(socket.handshake.session.passport.user);
                Room.findByIdAndUpdate(user.room.id, { $pull: { users: socket.handshake.session.passport.user } }).then(() => {
                    socket.to(user.room.name).emit('userLeftMessageForRoomMembers', {
                            userName: user.fullName,
                            messageType: 'left'
                        });
                        // Update the User list for all other users in that room
                        socket.to(user.room.name).emit('userLeftRoomUpdateUserList', {
                            _id : socket.handshake.session.passport.user
                        });
                    return;
                });
            })
            .catch((err) => {
                console.log(err);
            });

    });

});

app.use(passport.initialize()); //
app.use(passport.session()); //

//
passport.serializeUser((user, done) => {
    done(null, user.id);
});

//
passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

//
passport.use(new FacebookStatergy({
    clientID: process.env.FB_CLIENT_ID || '369458576832405',
    clientSecret: process.env.FB_SECRET || 'ec7a902660045d79e3606088dfe8389d',
    profileFields: ['email', 'displayName', 'photos'],
    callbackURL: process.env.FB_CALLBACK || 'http://localhost:' + app.get('port') + '/auth/facebook/callback',
    passReqToCallback: true,
    enableProof: true
}, (req, token, refreshToken, profile, done) => {
    User.findOne({ facebook: profile.id }).then((user) => {
        if (user) {
            return done(null, user);
        } else {
            var newUser = new User({
                facebook: profile.id,
                fullName: profile.displayName,
                email: profile._json.email,
                userImage: 'https://graph.facebook.com/' + profile.id + '/picture?type=large',
            });
            newUser.fbTokens.push({ token: token });
            newUser.save().then((user) => {
                done(null, user);
            }).catch((err) => {
                console.log(err);
            });
        }
    }).catch((err) => {
        console.log(err);
    });
}));

passport.use(new LocalStrategy({
    passReqToCallback: true,
},
    function (req, username, password, done) {
        User.findOne({ email: username }, function (err, user) {
            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            // if (!user.verifyPassword(password)) { return done(null, false); }
            if (req.body.password !== user.password) {
                return done(null, false);
            } else {
                console.log(user.password);
                console.log(req.body.password);
                return done(null, user);
            }
        });
    }));

//
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.redirect('/login');
}

//
app.get('/', isLoggedIn, (req, res) => {
    // console.log(req.user);
    User.findById(req.user._id)
        .populate('friends', null, { status: "Online" })
        .then((loggedInUser) => {
            // console.log(loggedInUser);
            res.render('home', {
                user: req.user,
                friendList: loggedInUser.friends
            });
        }).catch((err) => {
            console.log(err);
        });
});

//
app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login Form'
    });
});

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register Form'
    });
});

app.post('/register', (req, res) => {
    console.log(req.body);
    User.findOne({ email: req.body.email, password: req.body.password })
        .then((user) => {
            console.log(user);
            if (!user) {
                if (req.body.email !== "" && req.body.password !== "") {
                    var userRecord = new User({
                        "email": req.body.email,
                        "password": req.body.password,
                        "fullName": req.body.fullName
                    });
                    userRecord.save().then((userData) => {
                        res.redirect('/login');
                    }, (err) => {
                        res.redirect('/register');
                    });
                } else {
                    res.redirect('/register');
                }
            }
        }, (err) => {
            console.log(err);
        });
});

//
app.get('/logout', (req, res) => {
    req.logout();
    req.session.destroy();
    return res.redirect('/login');
});

//
app.get('/search_friends/:string?', isLoggedIn, (req, res) => {
    if (req.params.string !== undefined) {


        User.aggregate([
            {
                $match: {
                    $and: [
                        {
                            _id: { $ne: req.user._id }
                        },
                        {
                            fullName: new RegExp(req.params.string, 'i')
                        },
                        {
                            friends: { $nin: [req.user._id] }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    requestSent: {
                        $cond: [
                            {
                                $in: [req.user._id, "$friendRequest"]
                            },
                            1,
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    fullName: 1,
                    userImage: 1,
                    status: 1,
                    requestSent: 1
                }
            }
        ]).collation('users')
            .then((result) => {
                // console.log(result);
                res.json(result);
            }).catch((err) => {
                console.log(err);
            });

    } else {
        res.json([]);
    }
    // User.find({
    //     $and: [
    //         {
    //             _id: { $ne: req.user._id }
    //         },
    //         {
    //             fullName: new RegExp(req.params.string, 'i')
    //         }
    //     ]
    // })
    //     .select({ fullName: 1, _id: 1, userImage: 1, status: 1 })
    //     .then((allUsersExceptCurrentUser) => {
    //         return allUsersExceptCurrentUser;
    //     })
    //     .then((allUsersExceptCurrentUser) => {
    //         return User.findById(req.user._id).then((currentUser) => {
    //             return {
    //                 friends: currentUser.friends,
    //                 allUsersExceptCurrentUser: allUsersExceptCurrentUser
    //             }
    //         });
    //     })
    //     .then((dataForCompare) => {
    //         // console.log(dataForCompare);
    //         var comparedList = dataForCompare.allUsersExceptCurrentUser.filter((user) => {
    //             if (dataForCompare.friends.indexOf(user._id) == -1) {
    //                 return user;
    //             }
    //         });

    //         res.json(comparedList);
    //     })
    //     .catch((err) => {
    //         res.status(401).json(err);
    //     });
});

app.get('/auth/facebook', passport.authenticate('facebook', {
    scope: 'email'
}));

app.post('/auth/local', passport.authenticate('local', { failureRedirect: '/login' }), function (req, res) {
    res.redirect('/');
});

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/login'
}));



//
server.listen(app.get('port'), () => {
    console.log('Server Started at ' + app.get("port"));
});