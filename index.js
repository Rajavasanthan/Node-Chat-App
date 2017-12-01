const express = require('express');
const app = express();

const http = require('http');
const server = http.createServer(app);

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const mongoose = require('mongoose');
const cookiParser = require('cookie-parser');
const passport = require('passport');
const FacebookStatergy = require('passport-facebook').Strategy;

//Models
var { User } = require('./models/user');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/mydb');

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'fjdsffdsfafddsfdsf',
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

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
    clientID: '369458576832405',
    clientSecret: 'ec7a902660045d79e3606088dfe8389d',
    profileFields: ['email', 'displayName', 'photos'],
    callbackURL: 'http://localhost:3000/auth/facebook/callback',
    passReqToCallback: true
}, (req, token, refreshToken, profile, done) => {
    User.findOne({ facebook: profile.id }).then((user) => {
        console.log(user);
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
                console
            });
        }
    }).catch((err) => {
        console.log(err);
    });
}));

function isLoggedIn(req, res, next) {
    console.log(req.isAuthenticated());
    if (req.isAuthenticated()) {
        return next();
    }
    return res.redirect('/login');
}

app.get('/', isLoggedIn, (req, res) => {
    res.send('hi');
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login Form'
    });
});

app.get('/logout', (req, res) => {
    req.logout();
    req.session.destroy();
    return res.redirect('/');
});



app.get('/auth/facebook', passport.authenticate('facebook', {
    scope: 'email'
}));

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

server.listen(3000, () => {
    console.log('Server Started');
});