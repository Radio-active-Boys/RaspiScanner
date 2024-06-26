#!/bin/bash

# Disable NTP to prevent automatic time synchronization
sudo timedatectl set-ntp false

# Wait for 1 second to ensure the previous request is finished
sleep 1

# Set the time
sudo timedatectl set-time "$1"

# Wait for 1 second to ensure the time is set
sleep 1

# Ensure NTP remains disabled permanently
sudo systemctl stop systemd-timesyncd
sudo systemctl disable systemd-timesyncd
