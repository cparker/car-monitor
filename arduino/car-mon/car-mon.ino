/**
  This reads GPS data from a GY-NEO6MV2 GPS module and POSTs to a URL
  via a sim900 module
  adding a comment
*/

#include <TinyGPS++.h>
#include <SoftwareSerial.h>

// when we acquire a location from GPS, this is the maximum # of attempts per loop()
const int maxGPSReadAttempts = 25;

const String postURL = "http://truck-monitor.herokuapp.com/truckLocation";
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
int sim900RXPin = 12;

TinyGPSPlus gps;

SoftwareSerial gpsSerial(gpsRXPin, gpsTXPin,false,1024);
SoftwareSerial sim900Serial(sim900RXPin, sim900TXPin,false,64);


void setup() {
  Serial.begin(ioSerialBaud);
  Serial.println("Hello");

  gpsSerial.begin(gpsBaud);
  sim900Serial.begin(sim900Baud);
}

unsigned char buffer[64]; // buffer array for data recieve over serial port
int count = 0;   // counter for buffer array

void loop()
{
  getLocationFromGPS();

  if (gps.location.isValid()) {
    String jsonString = buildGPSJSON();
    Serial.println(jsonString);
    postJSON(jsonString);
  } else {
    Serial.print("Acquiring fix.  # of sattelites ");
    Serial.println(gps.satellites.value());
  }
  delay(30 * 1000);
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




void postUpdate() {
  // number of times to wait for a complete set of data from GPS module
  boolean successfulRead = false;

  gpsSerial.flush();
  for (int i = 0; i < maxGPSReadAttempts && !successfulRead; i++) {
    Serial.print("pass ");
    Serial.println(i);
    while (gpsSerial.available() > 0) {
      Serial.println("we have avail");
      if (gps.encode(gpsSerial.read())) {
        if (gps.location.isValid()) {
          Serial.println("gps location is valid");
          String gpsJSON = "";
          Serial.print("GPS JSON ");
          Serial.println(gpsJSON);
          postJSON(gpsJSON);
          successfulRead = true;
        } else {
          Serial.println("location wasn't valid");
          delay(1000);
        }
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



void displayGPSInfo()
{
  Serial.print(F("Location: "));
  if (gps.location.isValid())
  {
    Serial.print(gps.location.lat(), 6);
    Serial.print(F(","));
    Serial.print(gps.location.lng(), 6);
  }
  else
  {
    Serial.print(F("INVALID"));
  }

  Serial.print(F("  Date/Time: "));
  if (gps.date.isValid())
  {
    Serial.print(gps.date.month());
    Serial.print(F("/"));
    Serial.print(gps.date.day());
    Serial.print(F("/"));
    Serial.print(gps.date.year());
  }
  else
  {
    Serial.print(F("INVALID"));
  }

  Serial.print(F(" "));
  if (gps.time.isValid())
  {
    if (gps.time.hour() < 10) Serial.print(F("0"));
    Serial.print(gps.time.hour());
    Serial.print(F(":"));
    if (gps.time.minute() < 10) Serial.print(F("0"));
    Serial.print(gps.time.minute());
    Serial.print(F(":"));
    if (gps.time.second() < 10) Serial.print(F("0"));
    Serial.print(gps.time.second());
    Serial.print(F("."));
    if (gps.time.centisecond() < 10) Serial.print(F("0"));
    Serial.print(gps.time.centisecond());
  }
  else
  {
    Serial.print(F("INVALID"));
  }

  Serial.println("");
  Serial.print("Altitude Feet: ");  Serial.println(gps.altitude.feet());
  Serial.println("Speed MPH"); Serial.println(gps.speed.mph());

  Serial.println();
}


void clearBufferArray()              // function to clear buffer array
{
  for (int i = 0; i < count; i++)
  {
    buffer[i] = NULL; // clear all index of array with command NULL
  }
}
