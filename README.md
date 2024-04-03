# Speed & Ping Test

SpeedTest is a web application designed for conducting internet speed tests and ping tests to chosen hosts from the server level. It enables quick verification of internet connection quality through a web interface. The site utilizes system tools such as mtr and speedtest-cli to conduct network tests.

## Technologies
![image](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)
![image](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![image](https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white)
![image](https://img.shields.io/badge/Chart%20js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![image](https://img.shields.io/badge/Socket.io-010101?&style=for-the-badge&logo=Socket.io&logoColor=white)
![image](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![image](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![image](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)

## Installation
```
apt-get update && apt-get -y upgrade

apt-get -y install mtr pip npm

pip install --break-system-packages speedtest-cli

npm init -y
npm install express socket.io uuidv4
```
To verify network settings, change the following values to the correct ones in the server file index.js
```
const PORT = 80;
const protocol = "http";
const localpath = "127.0.0.1";
```

To use the application, open a browser and enter the server address. On the homepage, you can select the type of test (ping or speed test), enter the address of the host to ping, and the number of packets. Press Start to begin the test. The results will be displayed on a chart and in tables.

![image](https://github.com/modek4/speed-and-ping-test/assets/85760836/7f82790d-b5c4-4c25-803e-8c741858b26a)

## Features
- Ability to conduct ping and internet speed tests.
- Visualization of results through charts.
- Interactive user interface with a responsive design.
- Ability to export results to CSV and JSON formats.
