var app = angular.module('truckMonitor', ['uiGmapgoogle-maps']);

app.config(function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyBbLW5sJvcmtSIn7GBNoadc1m-DQgW9AFo',
        libraries: 'weather,geometry,visualization'
    })

});

app.factory('dataService', ['$q', '$http', function($q, $http) {

    var currentLocationURL = '/truckLastLocation';
    var locationHistoryURL = '/truckLocation';

    var currentLocation = function() {
        return $http.get(currentLocationURL);

        /*
        return $q.when({
            "lat": 39.9787232,
            "lon": -105.161233,
            "speedMPH": 20.0,
            "altFt": 12.0,
            "heading": 123.0
        })
        */
    };

    var locationHistory = function() {
        return $http.get(locationHistoryURL);

        /*
          return $q.when([{
              "lat": 39.9787232,
              "lon": -105.161233,
              "speedMPH": 20.0,
              "altFt": 12.0,
              "heading": 123.0
          }, {
              "lat": 40.3487232,
              "lon": -106.331233,
              "speedMPH": 20.0,
              "altFt": 12.0,
              "heading": 123.0
          }, {
              "lat": 41.1187232,
              "lon": -107.561233,
              "speedMPH": 20.0,
              "altFt": 12.0,
              "heading": 123.0
          }, {
              "lat": 42.3787232,
              "lon": -108.561233,
              "speedMPH": 20.0,
              "altFt": 12.0,
              "heading": 123.0
          }, {
              "lat": 43.3787232,
              "lon": -109.561233,
              "speedMPH": 20.0,
              "altFt": 12.0,
              "heading": 123.0
          }]);
          */
    };

    return {
        currentLocation: currentLocation,
        locationHistory: locationHistory
    };
}]);


app.controller('AppCtrl', ['$scope', '$interval', 'dataService', 'uiGmapGoogleMapApi',
    function($scope, $interval, dataService, uiGmapGoogleMapApi) {
        var pollInterval = 10000;

        $scope.polylines = [];

        var updateCurrentLocation = function() {
            dataService.currentLocation()
                .then(function(cur) {
                    $scope.map.center = {
                        latitude: cur.data.loc.coordinates[1],
                        longitude: cur.data.loc.coordinates[0]
                      };

                    $scope.current = {
                        lastUpdate: moment(cur.data.dateTime).fromNow(),
                        altFt: cur.data.altFt,
                        locationDetails: cur.data.locationDetails,
                        speedMPH: cur.data.speedMPH,
                        heading: cur.data.heading,
                        coords: {
                            latitude: cur.data.loc.coordinates[1],
                            longitude: cur.data.loc.coordinates[0]
                        },
                        options: {
                            clickable: false,
                            icon: 'favicon-32x32.png'
                        }
                    };
                });
        };

        $interval(function() {
          updateCurrentLocation();
        }, pollInterval);

        dataService.locationHistory()
            .then(function(historyPoints) {

                var locationHistoryPath = _.map(historyPoints.data, function(point) {
                    return {
                        latitude: point.loc.coordinates[1],
                        longitude: point.loc.coordinates[0]
                    };
                });

                $scope.polylines = [{
                    id: 1,
                    path: locationHistoryPath,
                    stroke: {
                        color: '#6060FB',
                        weight: 3
                    }

                }];
            });



        $scope.map = {
            center: {
                latitude: 39.8282,
                longitude: -98.5795
            },
            zoom: 6,
            options: {
                streetViewControl: true
            }
        };

        updateCurrentLocation();
    }
]);
