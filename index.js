const express = require('express');
const app = express();

const http = require('http');
const server = http.createServer(app);

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.send('hi');
});

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register Form'
    });
});

server.listen(3000, () => {
    console.log('Server Started');
});