document.addEventListener('DOMContentLoaded', () => {
    const configureForm = document.getElementById('configureForm');
    const connectForm = document.getElementById('connectForm');
    const ssidSelect = document.getElementById('ssid');
    const configuredDeviceDisplay = document.getElementById('configuredDevice');

    configureForm.addEventListener('submit', (event) => {
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
            document.getElementById('ssid').value = '';
            document.getElementById('password').value = '';
            configuredDeviceDisplay.innerHTML = 'Configured Wi-Fi SSID: <strong>' + ssid + '</strong>';
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });

    connectForm.addEventListener('submit', (event) => {
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
    });

    fetch('/')
    .then(response => response.json())
    .then(data => {
        const { ssids, configuredDevice } = data;
        ssidSelect.innerHTML = ssids.length > 0 
            ? ssids.map(ssid => `<option value="${ssid}">${ssid}</option>`).join('\n')
            : '<option value="">None</option>';
        configuredDeviceDisplay.innerHTML = configuredDevice;
    })
    .catch(error => {
        console.error('Error:', error);
    });
});
