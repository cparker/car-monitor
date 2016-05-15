var app = angular.module('truckMonitor', ['uiGmapgoogle-maps']);

app.config(uiGmapGoogleMapApiProvider => {
  uiGmapGoogleMapApiProvider.configure({
    key:'AIzaSyBbLW5sJvcmtSIn7GBNoadc1m-DQgW9AFo',
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
        return $q.when([]);
    };

    return {
        currentLocation: currentLocation,
        locationHistory: locationHistory
    }
}])

app.factory("Markers", () => {
    var Markers = [{
        "id": "0",
        "coords": {
            "latitude": "45.5200",
            "longitude": "-122.6819"
        },
        "window": {
            "title": "Portland, OR"
        }
    }, {
        "id": "1",
        "coords": {
            "latitude": "40.7903",
            "longitude": "-73.9597"
        },
        "window": {
            "title": "Manhattan New York, NY"
        }
    }];
    return Markers;
});

app.controller('AppCtrl', ['$scope', 'Markers', '$interval', 'dataService','uiGmapGoogleMapApi',
function($scope, Markers, $interval, dataService, uiGmapGoogleMapApi) {
    $interval(() => {
        $scope.now = moment().format('dddd, MMMM Do YYYY, h:mm:ss a');
    }, 1000)

    dataService.currentLocation()
        .then(cur => {
            $scope.current = {
              speedMPH : cur.speedMPH,
              heading : cur.heading,
              coords: {
                latitude: cur.lat,
                longitude: cur.lng
              },
              options: {
                clickable:false,
                icon:'favicon-32x32.png'
              }
            }
        })

    $scope.map = {
        center: {
            latitude: 39.8282,
            longitude: -98.5795
        },
        zoom: 4,
        options : {
          streetViewControl:true
        }
    };
    $scope.markers = Markers;
}]);
