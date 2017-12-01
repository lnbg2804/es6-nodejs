import { version } from '../../package.json';
import { Router } from 'express';
//import facets from './facets';
import axios from 'axios'
import querystring from 'querystring'
import crypto from 'crypto'
import cookie from 'cookie'
import request from 'request-promise'
import logger from '../lib/logger'
const nonce = require('nonce')();

export default ({ config, db }) => {

	const scopes = `read_products, write_products,
	read_product_listings, read_collection_listings,
	unauthenticated_write_checkouts, unauthenticated_write_customers
	read_fulfillments, write_fulfillments
	read_themes, write_themes
	read_checkouts, write_checkouts,
	read_orders, write_orders,
	read_script_tags, write_script_tags,
	read_customers, write_customers`;

	let api = Router();
	api.get('/', (req, res) => {
		res.json({ version });
	});
	// mount the facets resource
	//api.use('/facets', facets({ config, db }));
	//api.use('/order', order({ config, db }));
	// perhaps expose some API metadata at the root
	api.get('/install', (req, res) => {
		const shop = req.query.shop;
		if (shop) {
			const state = nonce();
			const redirectUri = process.env.NGROK + '/connect';
			const installUrl = 'https://' + shop +
				'/admin/oauth/authorize?client_id=' + process.env.SHOPIFY_API_KEY +
				'&scope=' + scopes +
				'&state=' + state +
				'&redirect_uri=' + redirectUri;
			res.cookie('state', state);
			logger.log(shop + " installed shopify application")
			res.redirect(installUrl);
		} else {
			return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
		}
	});
	api.get('/connect', (req, res) => {
		const { shop, hmac, code, state } = req.query;
		const stateCookie = cookie.parse(req.headers.cookie).state;
		if (state !== stateCookie) {
			return res.status(403).send('Request origin cannot be verified');
		}
		let accessToken = ""
		if (shop && hmac && code) {
			// DONE: Validate request is from Shopify
			const map = Object.assign({}, req.query);
			delete map['signature'];
			delete map['hmac'];
			const message = querystring.stringify(map);
			const generatedHash = crypto
				.createHmac('sha256', process.env.SHOPIFY_API_SECRET)
				.update(message)
				.digest('hex');

			if (generatedHash !== hmac) {
				return res.status(400).send('HMAC validation failed');
			}
			// DONE: Exchange temporary code for a permanent access token
			const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
			const accessTokenPayload = {
				client_id: process.env.SHOPIFY_API_KEY,
				client_secret: process.env.SHOPIFY_API_SECRET,
				code,
			};
			request.post(accessTokenRequestUrl, { json: accessTokenPayload })
				.then((accessTokenResponse) => {
					accessToken = accessTokenResponse.access_token;
					var userData  = {shop: shop, api_key: process.env.SHOPIFY_API_KEY, secret_key: process.env.SHOPIFY_API_SECRET, access_token: accessToken};
					db.query("SELECT COUNT(ID) AS COUNT FROM USERS WHERE shop = '" + shop + "'", function (error, results, fields) {
						let count = results[0].count
						if (count == 0) {
							db.query('INSERT INTO USERS SET ?', userData);
						} else {
							res.redirect("https://" + shop + "/admin/apps");
						}
					})
					// TODO
					const scriptTagBody = {
						"script_tag": {
							"event": "onload",
							"src": "https://fad8419c.ngrok.io/am.js",
						}
					};
					const scriptTagUri = 'https://' + shop + '/admin/script_tags.json';
					var configHeader = {
						headers: {
							'X-Shopify-Access-Token': accessToken,
							'Content-type': 'application/json'
						}
					};
					axios.post(scriptTagUri, scriptTagBody, configHeader)
						.then((response) => {
							if (response.status == 200) {
								logger.log("embedded script tags for " + shop)
								res.redirect("https://" + shop + "/admin/apps");
							} else {
								logger.log(response)
							}
						})
						.catch((error) => {
							logger.log("error when execute embed script tags")
							logger.log(error)
						});
				})
				.catch((error) => {
					logger.log("error when connect with app")
					logger.log(error)
				});
		} else {
			res.status(400).send('Required parameters missing');
		}
	})
	api.get('/order', (req, res) => {
		var origin = req.get('origin');
		origin = "deveioshop.myshopify.com"
		let query = `SELECT * FROM USERS WHERE shop = '${origin}'`
		db.query(query, function (error, results, fields) {
			logger.log(results[0])
			var config = {
				headers: {
					'X-Shopify-Access-Token': results[0].access_token,
					'Content-type': 'application/json'
				}
			};
			request.get(`https://${results[0].shop}/admin/orders.json`, config)
				.then(response => {
					res.send(response)
				})
				.catch(error => {
					res.json(error)
				})
		})
	})
	return api;
}
