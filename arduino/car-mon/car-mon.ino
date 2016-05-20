/**
  This reads GPS data from a GY-NEO6MV2 GPS module and POSTs to a URL
  via a sim900 module
  adding a comment
*/

#include <TinyGPS++.h>
#include <SoftwareSerial.h>
#include <EEPROM.h>


// when we acquire a location from GPS, this is the maximum # of attempts per loop()
const int maxGPSReadAttempts = 25;

const int builtinRedLED = 16;

const int gpsPowerPin = 2;
const int sim900PowerPin = 0;

// if speed in MPH is faster than this, we're moving
const int movingThresholdMPH = 10;

// if we're still for this many cycles, go into deep sleep
const int numStillCyclesForDeepSleep = 10;

// if the truck is moving , post updates more often
const int movingSleepIntervalSec = 30;
const int stationarySleepIntervalSec = 5 * 60;

const String postURL = "http://truck-monitor.herokuapp.com/truckLocation";
const int jsonPostSize = 256;
const String doneStr = "+++DONE";

int ioSerialBaud = 19200;
int sim900Baud = 19200;
int gpsBaud = 9600;

// pins for software serial communication with GPS
int gpsTXPin = 5;
int gpsRXPin = 4;

// SIM900x
int sim900TXPin = 14;
int sim900RXPin = 12;

// for keeping count of how long we're sitting still
byte stillCycleCount = 0;

TinyGPSPlus gps;
SoftwareSerial gpsSerial(gpsRXPin, gpsTXPin,false,1024);;
SoftwareSerial sim900Serial(sim900RXPin, sim900TXPin,false,64);;


void setup() {
  EEPROM.begin(4);

  pinMode(builtinRedLED, OUTPUT);
  digitalWrite(builtinRedLED, LOW);

  // power up the GPS
  digitalWrite(gpsPowerPin, LOW);

  // everything is in setup because we're using deep sleep
  Serial.begin(ioSerialBaud);
  Serial.println("Truck Monitor - cp@cjparker.us 2016");

  stillCycleCount = EEPROM.read(0);
  if (stillCycleCount > 100) {
    // this means we're uninitialized
    Serial.println("setting eeprom value for the first time");
    EEPROM.write(0,0);
  }

  gpsSerial.begin(gpsBaud);
  sim900Serial.begin(sim900Baud);
  Serial.flush();
  gpsSerial.flush();
  sim900Serial.flush();
  delay(100);

  // check status of, and possibly power on sim900
  checkSim900Status();

  gpsSerial.enableRx(true);
  sim900Serial.enableRx(false);

  boolean postedLocation = false;

  while (!postedLocation) {
    getLocationFromGPS();

    if (gps.location.isValid()) {
      gpsSerial.enableRx(false);
      sim900Serial.enableRx(true);
      String jsonString = buildGPSJSON();
      Serial.println(jsonString);
      postJSON(jsonString);
      postedLocation = true;
    } else {
      Serial.print("Acquiring fix.  # of sattelites ");
      Serial.println(gps.satellites.value());
    }
    digitalWrite(builtinRedLED, !digitalRead(builtinRedLED));
    delay(1000);
  }

  // turn off red led
  digitalWrite(builtinRedLED, HIGH);

  // power down the GPS
  digitalWrite(gpsPowerPin, HIGH);

  if (gps.speed.mph() >= movingThresholdMPH) {
    Serial.println("we're moving");
    stillCycleCount = 0;
    EEPROM.write(0,stillCycleCount);
    EEPROM.commit();
  } else {
    Serial.println("we're stationary");
    stillCycleCount++;
    if (stillCycleCount <= 100) {
      EEPROM.write(0,stillCycleCount);
      EEPROM.commit();
    }
  }

  // long or short nap
  if (stillCycleCount >= numStillCyclesForDeepSleep) {
    Serial.println("deep sleep");
    ESP.deepSleep(stationarySleepIntervalSec * 1000000);
  } else {
    Serial.println("short sleep");
    ESP.deepSleep(movingSleepIntervalSec * 1000000);
  }
}


void checkSim900Status() {
  char buffer[64];
  int count = 0;
  gpsSerial.enableRx(false);
  sim900Serial.enableRx(true);

  sim900Serial.println("AT");
  delay(100);
  while(sim900Serial.available() > 0) {
    buffer[count++] = sim900Serial.read();
    if (count == 64) {
      break;
    }
  }

  // if the buffer contains 'OK' , we're good
  if (String(buffer).indexOf('OK') != -1) {
    Serial.println("sim900 is active");
  } else {
    Serial.println("sim900 is not responding, powering on");
  }

  digitalWrite(sim900PowerPin, HIGH);
  delay(1000);
  digitalWrite(sim900PowerPin, LOW);

  // wait for it to start, then try to talk to it again
  delay(5000);
  sim900Serial.println("AT");
  delay(100);
  count = 0;
  while(sim900Serial.available() > 0) {
    buffer[count++] = sim900Serial.read();
    if (count == 64) {
      break;
    }
  }

  if (String(buffer).indexOf('OK') != -1) {
    Serial.println("sim900 is active");
  } else {
    Serial.println("sim900 STILL NOT RESPONDING");
  }
}


unsigned char buffer[64]; // buffer array for data recieve over serial port
int count = 0;   // counter for buffer array

void loop()
{
}




void getLocationFromGPS() {

  boolean gotValidSentence = false;

  for (int i = 0; i < maxGPSReadAttempts && !gotValidSentence; i++) {
    while(gpsSerial.available() > 0) {
      char c = gpsSerial.read();
      if (gps.encode(c)) {
        gotValidSentence = true;
      }
    }
    delay(1); // feed the watchdog timer
  }

}





/*
 return a JSON string of gps data
 {
    "lat" : "",
    "lon" : "",
    "speedMPH" : "",
    "altFt" : "",
    "date" : "",
    "time" : "",
    "numSat" : n
 }
*/

/*
  See : http://arduiniana.org/libraries/tinygpsplus/
*/
String buildGPSJSON() {
  String json = "";
  json += "{";
  json += "\"lat\" : ";
  json += String(gps.location.lat(),7);
  json += ",\"lon\" :";
  json += String(gps.location.lng(),7);
  json += ",";
  json += "\"speedMPH\" : ";
  json += gps.speed.mph();
  json += ",";
  json += "\"altFt\" : ";
  json += gps.altitude.feet();
  json += ",";
  json += "\"date\" : \"";
  json += gps.date.value();
  json += "\", \"time\" : \"";
  json += gps.time.value();
  json += "\", \"numSats\" :";
  json += gps.satellites.value();
  json += ", \"heading\":";
  json += gps.course.deg();
  json += "}";
  return json;
}

void postJSON(String json) {
  Serial.println("postingJSON");

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
    String("at+httpdata=") + json.length() + String(",") + String(msToTransmit),
    doneStr
  };

  String endPostSequence[] = {
    "at+httpaction=1",
    "at+httpterm",
    doneStr
  };

  sendSIMCommands(postBeginSequence);
  delay(2000);
  Serial.print("posting json ");
  Serial.println(json);
  sim900Serial.println(json);
  delay(100);
  copySIMResponseToSerialIO();
  delay(2000);
  sendSIMCommands(endPostSequence);
  Serial.println("done sending json");
}



void copySIMResponseToSerialIO() {
  while(sim900Serial.available()) {
    Serial.write(sim900Serial.read());
  }
}



void sendSIMCommands(String commands[]) {
  int commandDelay = 2000;
  copySIMResponseToSerialIO();

  boolean done = false;
  int i = 0;
  while (!done) {
    digitalWrite(builtinRedLED, !digitalRead(builtinRedLED));
    String cmd = commands[i];
    if (String(cmd) != String(doneStr)) {
      Serial.print("sending command: ");
      Serial.println(cmd);
      sim900Serial.println(cmd);
      delay(100);
      copySIMResponseToSerialIO();
      delay(commandDelay);
    } else {
      Serial.println("hit done command");
      done = true;
    }
    i++;
  }
}
