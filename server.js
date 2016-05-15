#!/usr/bin/env node

'use strict'

const pmongo = require('promised-mongo')
const express = require('express')
const morgan = require('morgan')
const _ = require('underscore')
const bodyParser = require('body-parser')
const session = require('express-session')
const moment = require('moment')
const Q = require('q')
const bluebird = require('bluebird')
const Await = require('asyncawait/await')
const Async = require('asyncawait/async')
const qpm = require('query-params-mongo')


module.exports = (() => {

    const locationURL = '/truckLocation'
    const dbName = 'truckLocation'
    const defaultDBConnection = `mongodb://localhost/${dbName}`
    const collectionName = 'locationHistory'


    const processQuery = qpm({
        autoDetect: [{
            fieldPattern: /_id$/,
            dataType: 'objectId'
        }]
    });

    let port = process.env.PORT || 5000

    let app = express()

    let mongoConnectStr, mongoCollectionName

    if (process.env.MONGODB_URI) {
      let mongoURITail = process.env.MONGODB_URI.substring(process.env.MONGODB_URI.lastIndexOf('/') + 1)
      let mongoURIHead = process.env.MONGODB_URI.substring(0, process.env.MONGODB_URI.lastIndexOf('/'))
      mongoConnectStr = mongoURIHead
      mongoCollectionName = mongoURITail
    } else {
      mongoConnectStr = defaultDBConnection
      mongoCollectionName = collectionName
    }
    console.log('mongoConnectStr', mongoConnectStr)
    console.log('mongoCollectionName', mongoCollectionName)
    let db = pmongo(mongoConnectStr)

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, contentType");
        res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
        next();
    });

    app.use(express.static('.'))
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({
        extended: true
    }))

    let getLocationHandler = (req, res) => {
        let mongoQuery = processQuery(req.query)
        db.collection(mongoCollectionName)
            .find(mongoQuery.filter)
            .sort(mongoQuery.sort)
            .skip(mongoQuery.skip)
            .limit(mongoQuery.limit)
            .then((queryResult) => {
                res.json(queryResult)
            })
            .catch((er) => {
                console.log('caught error', er)
                res.sendStatus(500, {
                    "error": er
                })
            })

    }

    let postLocationHandler = (req, res) => {
        console.log('body ', req.body);
        req.body.dateTime = moment().toDate()
        db.collection(mongoCollectionName).insert(req.body)
            .then(() => {
                res.sendStatus(201)
            })
            .catch((er) => {
                console.log('error on insert', er)
                res.sendStatus(500, {
                    "error": er
                })
            })
    }


    app.get(locationURL, getLocationHandler)
    app.post(locationURL, postLocationHandler)

    app.listen(port, () => {
        console.log(`listening on ${port}`)
    })

})()
