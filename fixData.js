#!/usr/bin/env node

'use strict'

const restClient = require('request-promise')
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
const mongodb = require('mongodb')


let mongoClient = bluebird.promisifyAll(mongodb).MongoClient;

let dbURI = process.env.MONGODB_URI || defaultDBConnection
let db


let doStuff = Async(() => {
    let db = Await(mongoClient.connect(dbURI))
    let records = Await(db.collection('locationHistory').find({loc:{"$exists" : false}}).toArray())
    _.each(records, rec => {
        let loc = {
            "type": "Point",
            coordinates: [rec.lon, rec.lat]
        }
        Await(db.collection('locationHistory').update({
            "_id": rec._id
        }, {
            "$set": {
                loc: loc
            }
        }, true, false))
        process.stdout.write('.')
    })
    console.log('done')

    console.log('connected')
})


doStuff()
