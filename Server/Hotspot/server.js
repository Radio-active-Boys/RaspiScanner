const https = require('https');
const express = require('express');
const os = require('os');
const fs = require('fs');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const options = {
    key: fs.readFileSync('./SSL/server.key'),
    cert: fs.readFileSync('./SSL/server.cert'),
};

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


app.get('/', (req, res) => {
    const raspiDateTime = getCurrentDateTime();

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sync Time and Start Scan</title>
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
                    text-align: center;
                }
                h2 {
                    color: #333;
                }
                .datetime-container {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 20px;
                }
                button {
                    padding: 10px 20px;
                    border-radius: 5px;
                    border: none;
                    background-color: #4CAF50;
                    color: white;
                    cursor: pointer;
                    margin-top: 20px;
                }
                button:hover {
                    background-color: #45a049;
                }
            </style>
            <script>
                let clientDateTime = '';

                // WebSocket connection
                const ws = new WebSocket('wss://' + window.location.host);
                ws.onopen = () => {
                    console.log('WebSocket connection established.');
                    const localTime = new Date();
                    ws.send(JSON.stringify({ time: localTime }));
                };
                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    clientDateTime = new Date(data.clientDateTime).toISOString();
                    document.getElementById('clientTime').textContent = new Date(data.clientDateTime).toLocaleString();
                };

                function syncTime() {
                    fetch('/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ clientDateTime })
                    })
                    .then(response => response.text())
                    .then(data => {
                        document.getElementById('raspiTime').textContent = new Date().toLocaleString();
                        alert(data);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                }

                function startScanning() {
                    fetch('/startScan', {
                        method: 'GET'
                    })
                    .then(response => response.text())
                    .then(data => {
                        alert(data);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                }
            </script>
        </head>
        <body>
            <div class="container">
                <h2>Sync Time with Raspberry Pi</h2>
                <div class="datetime-container">
                    <div>
                        <h3>Client Device Time</h3>
                        <p id="clientTime">Fetching...</p>
                    </div>
                    <div>
                        <h3>Raspberry Pi Time</h3>
                        <p id="raspiTime">${raspiDateTime}</p>
                    </div>
                </div>
                <button onclick="syncTime()">Sync Time</button>
                <button onclick="startScanning()">Start Scanning</button>
            </div>
        </body>
        </html>
    `;

    res.send(htmlContent);
});

app.post('/sync', (req, res) => {
    const { clientDateTime } = req.body;

    if (!clientDateTime) {
        return res.status(400).send('Client date and time not provided.');
    }

    // Parse the client date time string into a Date object
    const clientTime = new Date(clientDateTime);

    // Format the client time for Raspberry Pi set-time command
    const formattedDateTime = `${clientTime.getFullYear()}-${String(clientTime.getMonth() + 1).padStart(2, '0')}-${String(clientTime.getDate()).padStart(2, '0')} ${String(clientTime.getHours()).padStart(2, '0')}:${String(clientTime.getMinutes()).padStart(2, '0')}:${String(clientTime.getSeconds()).padStart(2, '0')}`;

    exec(`./set_time.sh "${formattedDateTime}"`, (error, stdout, stderr) => {
        if (error || stderr) {
            console.error(`Error synchronizing time with Raspberry Pi: ${error || stderr}`);
            return res.status(500).send('Error synchronizing time with Raspberry Pi.');
        }

        console.log(`Raspberry Pi time synchronized to: ${formattedDateTime}`);
        res.send('Time synchronized successfully.');
    });
});


app.get('/startScan', (req, res) => {
    exec('./start_scan.sh', (error, stdout, stderr) => {
        if (error || stderr) {
            console.error(`Error starting scanning: ${error || stderr}`);
            return res.status(500).send('Error starting scanning.');
        }

        console.log('Scanning started successfully.');
        res.send('Scanning started successfully.');
    });
});

const server = https.createServer(options, app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected.');

    // Respond to messages from clients
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const clientTime = new Date(data.time);
        ws.send(JSON.stringify({ clientDateTime: clientTime }));
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('WebSocket client disconnected.');
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
    console.log(`Server is running on https://${getLocalIPAddress()}:${PORT}`);
});
