'use strict';
/*global window */
window.app = {
  // Application Constructor
  initialize: function () {
    this.bindEvents();
  },
  // Bind Event Listeners
  //
  // Bind any events that are required on startup. Common events are:
  // 'load', 'deviceready', 'offline', and 'online'.
  bindEvents: function () {
    /*jslint browser:true */
    document.addEventListener('deviceready', this.onDeviceReady, false);
  },
  // deviceready Event Handler
  //
  // The scope of 'this' is the event. In order to call the 'receivedEvent'
  // function, we must explicity call 'app.receivedEvent(...);'
  onDeviceReady: function () {
    window.app.receivedEvent('deviceready');
  },
  // Update DOM on a Received Event
  receivedEvent: function (id) {
    /*jslint browser:true */
    console.log('bootstrapping NG');
    window.document.getElementById("myText").value = "BOOTSTRAPPING";
    angular.bootstrap(document, ['carMonitorApp']);
  }
};
window.app.initialize();
