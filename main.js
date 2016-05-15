var app = angular.module('truckMonitor', ['uiGmapgoogle-maps']);

app.config(uiGmapGoogleMapApiProvider => {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyBbLW5sJvcmtSIn7GBNoadc1m-DQgW9AFo',
        libraries: 'weather,geometry,visualization'
    })

})

app.factory('dataService', ['$q', ($q) => {

    var currentLocation = function() {
        return $q.when({
            "lat": 39.9787232,
            "lng": -105.161233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        })
    };

    var locationHistory = function() {
        return $q.when([{
            "lat": 39.9787232,
            "lng": -105.161233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        }, {
            "lat": 40.3487232,
            "lng": -106.331233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        }, {
            "lat": 41.1187232,
            "lng": -107.561233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        }, {
            "lat": 42.3787232,
            "lng": -108.561233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        }, {
            "lat": 43.3787232,
            "lng": -109.561233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        }]);
    };

    return {
        currentLocation: currentLocation,
        locationHistory: locationHistory
    }
}])


app.controller('AppCtrl', ['$scope', '$interval', 'dataService', 'uiGmapGoogleMapApi',
    function($scope, $interval, dataService, uiGmapGoogleMapApi) {
        $interval(() => {
            $scope.now = moment().format('dddd, MMMM Do YYYY, h:mm:ss a');
        }, 1000)

        $scope.polylines = [];

        dataService.currentLocation()
            .then(cur => {
                $scope.current = {
                    speedMPH: cur.speedMPH,
                    heading: cur.heading,
                    coords: {
                        latitude: cur.lat,
                        longitude: cur.lng
                    },
                    options: {
                        clickable: false,
                        icon: 'favicon-32x32.png'
                    }
                }
            })

        dataService.locationHistory()
            .then(historyPoints => {

                let locationHistoryPath = _.map(historyPoints, point => {
                    return {
                        latitude: point.lat,
                        longitude: point.lng
                    }
                })

                $scope.polylines = [{
                    id: 1,
                    path: locationHistoryPath,
                    stroke: {
                        color: '#6060FB',
                        weight: 3
                    }

                }];


            })



        $scope.map = {
            center: {
                latitude: 39.8282,
                longitude: -98.5795
            },
            zoom: 5,
            options: {
                streetViewControl: true
            }
        };
    }
]);
