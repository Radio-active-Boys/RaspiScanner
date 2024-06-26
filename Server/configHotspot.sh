#!/bin/bash

# Change to the desired directory
cd Hotspot

# Get the current date in a filesystem-friendly format
CURRENT_DATE=$(date "+%Y-%m-%d_%H-%M-%S")

# Run nodemon and append output to the log file
nodemon index.js >> /home/Admin1/Downloads/RaspiScanner/Log/HotspotServer/${CURRENT_DATE}.txt
