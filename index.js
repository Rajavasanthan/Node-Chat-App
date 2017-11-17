const express = require('express');
const app = express();

const http = require('http');
const server = http.createServer(app);

app.use(express.static('public'));

app.get('/',(req,res) => {
	res.send('hi');
});

server.listen(3000,() => {
	console.log('Server Started');
});