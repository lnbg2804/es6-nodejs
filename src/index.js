import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import initializeDb from './db';
import middleware from './middleware';
import api from './api';
import config from './config.json';
import Liquid from 'shopify-liquid'
import mysql from 'mysql'
import fs from 'fs'
import path from 'path'
import rfs from 'rotating-file-stream'
import dotenv from 'dotenv'



dotenv.config()

let app = express();
app.server = http.createServer(app);
// logger
var logDirectory = path.join(__dirname, 'logs')
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)
// create a rotating write stream
var accessLogStream = rfs('http.log', {
  interval: '1d', // rotate daily
  path: logDirectory
})
app.use(morgan('dev', {stream: accessLogStream}));
// 3rd party middleware
app.use(cors({
	exposedHeaders: config.corsHeaders
}));

var engine = Liquid(
	{
		root: __dirname, // for layouts and partials
		extname: '.liquid'
	}
);

// register liquid engine 
app.engine('liquid', engine.express());
app.set('views', './views');            // specify the views directory 
app.set('view engine', 'liquid');       // set to default 


app.use(bodyParser.json({
	limit: config.bodyLimit
}));
// connect to db
initializeDb(db => {
	db = mysql.createConnection('mysql://shopify:Shopify123456!@127.0.0.1/shopify?debug=true&timezone=+0700');
	db.connect((err) => {
		if (err) {
			console.error('error connecting: ' + err.stack);
			return 0;
		}
		console.log(`connected as id ${db.threadId}`);
	})
	// internal middleware
	app.use(middleware({ config, db }));
	// api router
	app.use('/', api({ config, db }));

	app.server.listen(process.env.PORT || config.port, () => {
		console.log(`Started on port ${app.server.address().port}`);
	});
	
});

export default app;
