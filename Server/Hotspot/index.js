const https = require('https');
const express = require('express');
const os = require('os');
const fs = require('fs');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const options = {
    key: fs.readFileSync('./SSL/server.key'),
    cert: fs.readFileSync('./SSL/server.cert'),
};

app.get('/', (req, res) => {
    exec('sudo nmcli dev wifi rescan && nmcli -t -f SSID dev wifi', (error, stdout, stderr) => {
        if (error || stderr) {
            return res.status(500).send(`Failed to scan Wi-Fi networks: ${error || stderr}`);
        }

        const ssids = stdout.trim().split('\n').filter(ssid => ssid);
        let ssidOptions = ssids.length > 0 
            ? ssids.map(ssid => `<option value="${ssid}">${ssid}</option>`).join('\n')
            : '<option value="">None</option>';

        fs.readFile('../wifi.txt', 'utf8', (err, data) => {
            let configuredDevice = 'No device configured';
            if (!err && data.trim()) {
                const ssidLine = data.trim().split('\n')[0];
                const ssid = ssidLine.includes('SSID=') && ssidLine.split('=')[1] ? ssidLine.split('=')[1] : 'None';
                configuredDevice = `Configured Wi-Fi SSID: <strong>${ssid}</strong>`;
            }

            const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Codely</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            background-color: #f0f0f0;
                        }
                        .container {
                            background-color: #fff;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                            max-width: 400px;
                            width: 100%;
                        }
                        h2 {
                            color: #333;
                            justify-content: center;
                        }
                        form {
                            display: flex;
                            flex-direction: column;
                        }
                        label, select, input {
                            margin-bottom: 10px;
                            font-size: 1rem;
                        }
                        select, input[type="password"], input[type="submit"] {
                            padding: 8px;
                            border-radius: 5px;
                            border: 1px solid #ccc;
                            font-size: 1rem;
                        }
                        input[type="submit"] {
                            background-color: #4CAF50;
                            color: white;
                            border: none;
                            cursor: pointer;
                        }
                        input[type="submit"]:hover {
                            background-color: #45a049;
                        }
                        #configuredDevice {
                            margin-bottom: 20px;
                            color: #555;
                        }
                        #status {
                            color: red;
                            margin-top: 20px;
                        }
                    </style>
                    <script>
                        function configureWifi(event) {
                            event.preventDefault();
                            const ssid = document.getElementById('ssid').value;
                            const password = document.getElementById('password').value;

                            fetch('/configure', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ ssid, password })
                            })
                            .then(response => response.text())
                            .then(data => {
                                alert('Wi-Fi credentials saved.');
                                // Clear the input fields
                                document.getElementById('ssid').value = '';
                                document.getElementById('password').value = '';
                                // Update configured device display
                                document.getElementById('configuredDevice').innerHTML = 'Configured Wi-Fi SSID: <strong>' + ssid + '</strong>';
                            })
                            .catch(error => {
                                console.error('Error:', error);
                            });
                        }

                        function connectWifi(event) {
                            event.preventDefault();

                            fetch('/connect', {
                                method: 'POST'
                            })
                            .then(response => response.text())
                            .then(data => {
                                alert(data);
                            })
                            .catch(error => {
                                console.error('Error:', error);
                            });
                        }

                        function checkStatus() {
                            fetch('/status')
                            .then(response => response.text())
                            .then(data => {
                                if (data.trim()) {
                                    document.getElementById('status').innerText = data;
                                }
                            })
                            .catch(error => {
                                console.error('Error:', error);
                            });
                        }

                        // Poll for connection status every 5 seconds
                        setInterval(checkStatus, 5000);
                    </script>
                </head>
                <body>
                    <div class="container">
                        <h2>Vishal Hotspot connector</h2>
                        <form onsubmit="configureWifi(event)">
                            <label for="ssid">WiFi SSID:</label>
                            <select id="ssid" name="ssid">
                                ${ssidOptions}
                            </select><br><br>
                            <label for="password">Password:</label>
                            <input type="password" id="password" name="password"><br><br>
                            <input type="submit" value="Submit">
                        </form>
                        <h2>Connect to Available Wi-Fi</h2>
                        <p id="configuredDevice">${configuredDevice}</p>
                        <form onsubmit="connectWifi(event)">
                            <input type="submit" value="Connect">
                        </form>
                        <div id="status"></div>
                    </div>
                </body>
                </html>
            `;

            res.send(htmlContent);
        });
    });
});

app.post('/configure', (req, res) => {
    const ssid = req.body.ssid;
    const password = req.body.password;

    if (!ssid || !password) {
        return res.status(400).send('SSID and password are required.');
    }

    const wifiConfig = `SSID=${ssid}\nPASSWORD=${password}`;

    fs.writeFile('../wifi.txt', wifiConfig, (err) => {
        if (err) {
            return res.status(500).send(`Failed to save Wi-Fi credentials: ${err.message}`);
        }

        res.send('Wi-Fi credentials saved.');
    });
});

app.post('/connect', (req, res) => {
    fs.readFile('../wifi.txt', 'utf8', (err, data) => {
        if (err || !data.trim()) {
            fs.writeFileSync('../connect_status.txt', 'Error: Please configure Wi-Fi credentials first.');
            return res.status(400).send('Please configure Wi-Fi credentials first.');
        }

        const [ssid, password] = data.trim().split('\n').map(line => line.split('=')[1]);

        if (!ssid) {
            fs.writeFileSync('../connect_status.txt', 'Error: Please configure Wi-Fi credentials first.');
            return res.status(400).send('Please configure Wi-Fi credentials first.');
        }

        const rescan = `sudo nmcli dev wifi rescan`;
        exec(rescan, (error, stdout, stderr) => {
            if (error || stderr) {
                console.error(`Failed to rescan Wi-Fi networks: ${error || stderr}`);
                fs.writeFileSync('../connect_status.txt', 'Error: Failed to rescan Wi-Fi networks.');
                return res.status(500).send('Failed to rescan Wi-Fi networks.');
            }

            const deactivate = `sudo nmcli connection down Admin1`;
            exec(deactivate, (error, stdout, stderr) => {
                if (error || stderr) {
                    console.error(`Failed to deactivate existing connection: ${error || stderr}`);
                    fs.writeFileSync('../connect_status.txt', 'Error: Failed to deactivate existing connection.');
                    return res.status(500).send('Failed to deactivate existing connection.');
                }

                const command = `sudo nmcli dev wifi connect "${ssid}" password "${password}"`;
                exec(command, (error, stdout, stderr) => {
                    if (error || stderr) {
                        console.error(`Failed to connect to Wi-Fi network: ${error || stderr}`);
                        activateHotspot((err) => {
                            if (err) {
                                console.error(`Failed to activate hotspot: ${err}`);
                                fs.writeFileSync('../connect_status.txt', 'Error: Failed to connect to Wi-Fi network. Hotspot activation failed.');
                                return res.status(500).send('Failed to connect to Wi-Fi network. Hotspot activation failed.');
                            }
                            fs.writeFileSync('../connect_status.txt', 'Error: Failed to connect to Wi-Fi network  wrong credentials. Hotspot activated');
                            return res.status(500).send('Failed to connect to Wi-Fi network wrong credentials. Hotspot activated.');
                        });
                    } else {
                        fs.writeFileSync('../connect_status.txt', 'Success: Connected to Wi-Fi network.');
                        res.send(`Connected to Wi-Fi network: ${stdout}`);
                    }
                });
            });
        });
    });
});

app.get('/status', (req, res) => {
    fs.readFile('../connect_status.txt', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Failed to read connection status.');
        }
        if (data.trim()) {
            fs.writeFileSync('../connect_status.txt', ''); // Clear the status file after reading
        }
        res.send(data);
    });
});

https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function activateHotspot(callback) {
    const activateCommand = `sudo nmcli connection up Admin1`;
    exec(activateCommand, (error, stdout, stderr) => {
        if (error || stderr) {
            console.error(`Failed to activate hotspot: ${error || stderr}`);
            return callback(error || new Error(stderr));
        }
        console.log('Hotspot activated');
        callback(null);
    });
}
