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
const gju = require('geojson-utils')
const nodemailer = require('nodemailer')


module.exports = (() => {

    const emailSMTPS = process.env.SMTPS
    const milesPerMeter = 0.000621371
    const transporter = nodemailer.createTransport(emailSMTPS)
    const dailyUpdateURL = '/dailyUpdate'
    const locationURL = '/truckLocation'
    const lastLocationURL = '/truckLastLocation'
    const dbName = 'truckLocation'
    const defaultDBConnection = `mongodb://localhost/${dbName}`
    const mongoCollectionName = 'locationHistory'
    const gmapAPIKey = 'AIzaSyBbLW5sJvcmtSIn7GBNoadc1m-DQgW9AFo'

    const locationPreviousDays = 7

    let mongoClient = bluebird.promisifyAll(mongodb).MongoClient;



    let port = process.env.PORT || 5000

    let app = express()

    let dbURI = process.env.MONGODB_URI || defaultDBConnection
    let db

    console.log('dbURI', dbURI)
    mongoClient.connect(dbURI)
        .then(ddb => {
            console.log('connected to mongo')
            db = ddb
        })
        .catch(er => {
            console.log('error connecting to mongo', er)
        })

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

    let getLastLocation = Async((req, res) => {
        let location
        db.collection(mongoCollectionName)
            .find({})
            .sort({
                dateTime: -1
            })
            .limit(1)
            .toArray()
            .then((queryResult) => {
                if (!queryResult || queryResult.length <= 0) {
                    res.status(404).json({
                        "result": "no last location?  That's odd."
                    })
                } else {
                    location = queryResult[0]
                    console.log('location', location)
                    let geocodeRequest = {
                        uri: 'https://maps.googleapis.com/maps/api/geocode/json',
                        qs: {
                            key: gmapAPIKey,
                            latlng: `${location.loc.coordinates[1]},${location.loc.coordinates[0]}`,
                            result_type: 'locality|route|point_of_interest|subpremise|premise'
                        },
                        json: true
                    }
                    return restClient(geocodeRequest)
                }
            })
            .then(geocodeResponse => {
                //console.log('geocodeResponse', JSON.stringify(geocodeResponse,null,2))
                if (!geocodeResponse || !geocodeResponse.results || !geocodeResponse.results.length) {
                    console.log('no results from geocode', geocodeResponse)
                    res.json(location)
                } else {
                    let best = geocodeResponse.results[0]

                    let route = _.find(best.address_components, address => {
                        return _.contains(address.types, 'route')
                    })

                    let city = _.find(best.address_components, address => {
                        return _.contains(address.types, 'locality')
                    })

                    let state = _.find(best.address_components, address => {
                        return _.contains(address.types, 'administrative_area_level_1')
                    })

                    let locationDetails = {
                        route: route.short_name,
                        city: city.short_name,
                        state: state.short_name
                    }

                    location.locationDetails = locationDetails
                    res.json(location)
                }

            })
            .catch((er) => {
                console.log('caught error', er, er.stack)
                res.sendStatus(500, {
                    "error": er
                })
            })
    })

    let getLocationHandler = (req, res) => {
        let mongoQuery, mongoSort
        if (req.query.previousDays) {
            mongoQuery = {
                dateTime: {
                    $gte: moment().subtract(req.query.previousDays, 'days').toDate()
                }
            }
            mongoSort = {
                dateTime: 1
            }
        } else {
            mongoQuery = {
                dateTime: {
                    $gte: moment().subtract(locationPreviousDays, 'days').toDate()
                }
            }
            mongoSort = {
                dateTime: 1
            }
        }
        console.log('mq', JSON.stringify(mongoQuery, null, 2))
        db.collection(mongoCollectionName)
            .find(mongoQuery)
            .sort(mongoSort)
            .skip(req.query.skip || 0)
            .limit(req.query.limit || 0).toArray()
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
        if (req.body && (req.body.lat === 0 || req.body.lon === 0)) {
            console.log('lat or lon is zero, not saving bad data')
            res.sendStatus(400, {
                "error": "lat or lon was 0"
            })
            return false
        }

        req.body.dateTime = moment().toDate()
        req.body.loc = {
            type: "Point",
            coordinates: [req.body.lon, req.body.lat]
        }
        delete req.body.lat
        delete req.body.lon
        db.collection(mongoCollectionName).insertOne(req.body)
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


    let dailyUpdateHandler = (req, res) => {
        let oneDayAgo = moment().subtract(1, 'days')
        db.collection(mongoCollectionName)
            .find({
                dateTime: {
                    "$gte": oneDayAgo.toDate()
                }
            })
            .sort({
                dateTime: 1
            })
            .toArray()
            .then(results => {
                let head = _.head(results)
                let tail = _.tail(results)
                let thresholdMeters = 100
                let totDistanceAlongPath = _.foldl(tail, (accum, currentPoint) => {
                    let dMet = gju.pointDistance(accum.point.loc, currentPoint.loc)
                        // filter out gps noise.
                    if (dMet >= thresholdMeters) {
                        return {
                            distance: accum.distance + dMet,
                            point: currentPoint
                        }
                    } else {
                        return {
                            distance: accum.distance,
                            point: currentPoint
                        }
                    }
                }, {
                    point: head,
                    distance: 0
                })
                console.log('tot distance along path (meters) ', totDistanceAlongPath.distance)
                console.log('miles ', totDistanceAlongPath.distance * milesPerMeter)
                sendEmail('cplp@cjparker.us', `You traveled ${(totDistanceAlongPath.distance * milesPerMeter).toFixed(1)} miles yesterday!`, () => {
                  res.sendStatus(201)
                })
            })
            .catch(er => {
                console.log('er', er)
                res.status(500).json({
                    error: er
                })
            })
    }

    let sendEmail = ((xto, message,cb) => {
      let todayStr = moment().format('ddd MMM Do YYYY')
        let mailOptions = {
            from: '"truckmonitor" <cjparker1971@gmail.com>', // sender address
            to: xto,
            subject: `daily update ${todayStr}`,
            text: message
        }

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: ' + info.response);
            cb()
        });


    })


    app.post(dailyUpdateURL, dailyUpdateHandler)
    app.get(locationURL, getLocationHandler)
    app.get(lastLocationURL, getLastLocation)
    app.post(locationURL, postLocationHandler)

    app.listen(port, '0.0.0.0', () => {
        console.log(`listening on ${port}`)
    })

})()
