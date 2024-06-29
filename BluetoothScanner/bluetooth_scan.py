import os
import asyncio
import time
from datetime import datetime
import json
from bleak import BleakScanner
import bluetooth
import threading

from flask import Flask, jsonify

app = Flask(__name__)

current_time = datetime.now().strftime("data_%d_%H_%M.json")
json_file_path = f"/home/Admin1/Downloads/RaspiScanner/BluetoothScanner/{current_time}"
node_name = "Admin1"

if not os.path.exists(json_file_path):
    with open(json_file_path, 'w') as f:
        json.dump([], f)

async def discover_devices():
    while True:
        try:
            start_time = time.time()
            devices = []
            bleak_devices = await BleakScanner.discover()
            for device in bleak_devices:
                devices.append({
                    "MAC_add": device.address,
                    "Timestamp": int(datetime.now().timestamp())
                })

            pybluz_devices = bluetooth.discover_devices(lookup_names=True)
            for addr, _ in pybluz_devices:
                devices.append({
                    "MAC_add": addr,
                    "Timestamp": int(datetime.now().timestamp())
                })

            process_devices(devices)

            end_time = time.time()

            total_time = end_time - start_time
            print(f"Total time taken for scan: {total_time:.2f} seconds")

            print(f"Scanned Devices - {len(devices)} devices")
        except Exception as e:
            print(f"Error in scanning devices: {e}")

def process_devices(devices):
    with open(json_file_path, 'r') as f:
        existing_devices = json.load(f)

    for device in devices:
        mac_address = device["MAC_add"]
        timestamp = device["Timestamp"]

        existing_device = next((d for d in existing_devices if d["MAC_add"] == mac_address), None)

        if existing_device:

            if node_name not in existing_device:

                existing_device[node_name] = [timestamp]
            else:

                existing_device[node_name].append(timestamp)
        else:
            new_device = {
                "MAC_add": mac_address,
                node_name: [timestamp]
            }
            existing_devices.append(new_device)

        real_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"Scanned Device - MAC: {mac_address}, Timestamp: {timestamp}, Real Time : {real_time}")

    with open(json_file_path, 'w') as f:
        json.dump(existing_devices, f, indent=4)

@app.route('/get_devices', methods=['GET'])
def get_devices():
    with open(json_file_path, 'r') as f:
        devices = json.load(f)
    return jsonify(devices)

if __name__ == "__main__":

    flask_thread = threading.Thread(target=app.run, kwargs={'port': 6000})
    flask_thread.start()

    loop = asyncio.get_event_loop()
    loop.run_until_complete(discover_devices())
