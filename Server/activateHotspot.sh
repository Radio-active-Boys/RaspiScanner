#!/bin/bash

check_hotspot_exists() {
    nmcli connection show | grep -q 'Admin1'
}

create_hotspot() {
    sudo nmcli connection add type wifi ifname wlan0 con-name Admin1 autoconnect yes ssid Admin1
    sudo nmcli connection modify Admin1 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared
    sudo nmcli connection modify Admin1 802-11-wireless-security.key-mgmt wpa-psk
    sudo nmcli connection modify Admin1 802-11-wireless-security.psk "00000000"
}

activate_hotspot() {
    sudo nmcli device wifi rescan
    sudo nmcli connection up Admin1
}

if ! check_hotspot_exists; then
    create_hotspot
fi

activate_hotspot