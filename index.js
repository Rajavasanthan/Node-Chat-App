const express = require('express');
const socketIO = require('socket.io');
const app = express();

const http = require('http');
const server = http.createServer(app);
const io = socketIO(server);
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const mongoose = require('mongoose');
const cookiParser = require('cookie-parser');
const passport = require('passport');
const FacebookStatergy = require('passport-facebook').Strategy;
const secret = require('./secret');
const sharedSession = require('express-socket.io-session');

//Models
var { User } = require('./models/user');

mongoose.Promise = global.Promise;
// mongoose.connect('mongodb://localhost/mydb');
mongoose.connect(secret.mongoUrl);

app.use(express.static('public'));
app.set('port', process.env.PORT || 3005);
app.set('view engine', 'ejs');
var chatSession = session({
    secret: 'fjdsffdsfafddsfdsf',
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
})
app.use(chatSession);


io.use(sharedSession(chatSession, {
    autoSave: true
}));

io.on('connection', (socket) => {
    User.findByIdAndUpdate(socket.handshake.session.passport.user, { $set: { status: 'Online', socketId: socket.id } })
        .populate('friends')
        .populate('friendRequest')
        .then((user) => {

            // console.log(socket.id);
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


    // socket.on('getFriendsList',() => {
    //     console.log('Server - gerFriendList');
    // });

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
                console.log(toUser);
                toUser.friendRequest.push(req.user._id);
                return toUser.save();
            })
            .then((toUser) => {
                return User.findById(req.params.toId)
                    .populate('friendRequest', { fullName: 1, _id: 1, userImage: 1, status: 1 })
                    .exec();
            })
            .then((toUser) => {
                console.log(toUser);
                io.to(toUser.socketId).emit('newFriendRequest', toUser.friendRequest);
                res.json("success");
            })
            .catch((err) => {
                console.log(err);
            });
    });


    app.get('/accept_friend/:friendId', (req, res) => {
        User.findByIdAndUpdate(req.user._id, {
            $pull: {
                friendRequest: req.params.friendId
            },
            $push: {
                friends: req.params.friendId
            }
        })

            .then((currentUserUpdated) => {

                return User.findByIdAndUpdate(req.params.friendId, {
                    $pull: {
                        sentRequest: req.user._id
                    },
                    $push: {
                        friends: req.user._id
                    }
                })

                    .then((friendUserUpdated) => {
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
                console.log(updatedResult);
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
                console.log(updatedResult);
                io.to(updatedResult.currentUser.socketId).emit('rejectFriendRequest', req.params.rejectId);
                io.to(updatedResult.rejectUser.socketId).emit('rejectFriendRequest', req.user._id);
                res.json("success");
            })
            .catch((err) => {
                console.log(err);
            });
    });

    socket.on('disconnect', function () {
        User.findByIdAndUpdate(socket.handshake.session.passport.user, { $set: { status: 'Offline', socketId: null } })
            .populate('friends')
            .then((user) => {
                console.log("User Logged Out");
                user.friends.forEach(function (friend) {
                    if (friend.socketId !== null) {
                        io.to(friend.socketId).emit('newMemberOffline', user);
                    }
                }, this);
            }).catch((err) => {
                console.log(err);
            });

    });

});

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

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

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.redirect('/login');
}

app.get('/', isLoggedIn, (req, res) => {
    // console.log(req.user);
    User.findById(req.user._id)
        .populate('friends', null, { status: "Online" })
        .then((loggedInUser) => {
            console.log(loggedInUser);
            res.render('home', {
                user: req.user,
                friendList: loggedInUser.friends
            });
        }).catch((err) => {
            console.log(err);
        });
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login Form'
    });
});

app.get('/logout', (req, res) => {
    req.logout();
    req.session.destroy();
    return res.redirect('/login');
});

app.get('/search_friends/:string?', isLoggedIn, (req, res) => {
    console.log();
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
                console.log(result);
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

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/login'
}));



server.listen(app.get('port'), () => {
    console.log('Server Started at ' + app.get("port"));
});