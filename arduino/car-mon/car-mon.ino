/**
  This reads GPS data from a GY-NEO6MV2 GPS module and POSTs to a URL
  via a sim900 module
*/

#include <TinyGPS++.h>
#include <SoftwareSerial.h>

const String postURL = "http://cjparker.us/nug/api/rawData";
const int jsonPostSize = 256;
const String doneStr = "+++DONE";

int ioSerialBaud = 19200;
int sim900Baud = 19200;
int gpsBaud = 9600;

// pins for software serial communication with GPS
int gpsTXPin = 0;
int gpsRXPin = 2;

// SIM900x
int sim900TXPin = 14;
int sim900RXPin = 13;

TinyGPSPlus gps;

SoftwareSerial gpsSerial(gpsRXPin, gpsTXPin);
SoftwareSerial sim900Serial(sim900RXPin, sim900TXPin);


void setup() {
  Serial.begin(ioSerialBaud);
  Serial.println("Hello");

  gpsSerial.begin(gpsBaud);
  sim900Serial.begin(sim900Baud);
}

void loop() {

  // see if GPS is sending data yet
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      String gpsJSON = buildGPSJSON();
      Serial.print("GPS JSON ");
      Serial.println(gpsJSON);
    }
  }

//  Serial.println("delay 10sec...");
//  delay(10000);
}


void postUpdate() {
  // number of times to wait for a complete set of data from GPS module
  int gpsPasses = 5;
  boolean successfulRead = false;

  for (int i = 0; i < gpsPasses && !successfulRead; i++) {
    while (gpsSerial.available() > 0) {
      if (gps.encode(gpsSerial.read())) {
        String gpsJSON = buildGPSJSON();
        Serial.print("GPS JSON ");
        Serial.println(gpsJSON);
        postJSON(gpsJSON);
        successfulRead = true;
      }
    }

  }


}

/*
 return a JSON string of gps data
 {
    "lat" : "",
    "lon" : "",
    "speedMPH" : "",
    "altFt" : ""
 }
*/
String buildGPSJSON() {
  Serial.println("gps location valid " + gps.location.isValid());
  /*
  39.325799
  -103.007813
  */
  char latStr[15];
  char lonStr[15];
  dtostrf(gps.location.lat(),12,7,latStr);
  dtostrf(gps.location.lng(),12,7,lonStr);

  String json = "";
  json += "{";
  json += "\"lat\":";
  json += "\"";
  json += latStr;
  json += "\"";
  json += ",";
  json += "\"lon\":";
  json += "\"";
  json += lonStr;
  json += "\"";
  json += ",";
  json += "\"speedMPH\":";
  json += gps.speed.mph();
  json += ",";
  json += "\"altFt\":";
  json += gps.altitude.feet();
  json += "}";
  return json;
}

void postJSON(String json) {
  int msToTransmit = 5000;
  // commands for posting via sim900
  String postBeginSequence[] = {
    "at",
    "at+sapbr=3,1,\"contype\",\"gprs\"",
    "at+sapbr=1,1",
    "at+sapbr=2,1",
    "at+httpinit",
    "at+httppara=\"cid\",1",
    "at+httppara=\"url\",\"" + postURL + "\"",
    "at+httppara=\"content\",\"application/json\"",
    String("at+httpdata=") + json.length() + String(",") + msToTransmit,
    doneStr
  };

  String endPostSequence[] = {
    "at+httpaction=1",
    "at+httpterm"
  };

  sendSIMCommands(postBeginSequence);
  sim900Serial.println(json);
  sendSIMCommands(endPostSequence);
}

void sendSIMCommands(String commands[]) {
  int commandDelay = 2000;

  boolean done = false;
  int i = 0;
  while (!done) {
    String cmd = commands[i];
    if (cmd != doneStr) {
      sim900Serial.println(cmd);
      delay(commandDelay);
    } else {
      done = true;
    }
    i++;
  }
}
