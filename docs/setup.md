# Setup guide

## 1. Run the dashboard in simulation mode

Requirements: Node.js 20+

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5173
```

Demo account: `demo@greenhouse.local` / `Demo1234`. Useful URL options: `?interval=1000` (readings every second),
`?speed=120` (faster simulated time).

## 2. Create the Firebase project

1. Open <https://console.firebase.google.com> and create a project (Google Analytics is not needed).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. Add a user for the device (e.g. `device@<your-project>.com`) in **Authentication → Users**.
4. **Build → Realtime Database → Create database** (location: `europe-west1`, start in *locked mode*).
5. **Project settings → Your apps → Web app (</>)** and copy the configuration values.
6. Approve the accounts that may use the greenhouse: copy each user's **User UID** from **Authentication → Users**
   and add it in **Realtime Database → Data** as `allowedUsers/<uid>` = `true`. Do this for the device account and
   for your own account. New accounts created on the sign-up page see a "waiting for approval" message until you add
   them here.

## 3. Connect the dashboard to Firebase

```bash
cd dashboard
cp .env.example .env    # fill in the values from step 2.5
npm run dev
```

The status bar shows **Live mode (Firebase)** when the connection is active.

## 4. Deploy rules, functions and hosting

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # put your project id
cd functions && npm install && cd ..
cd dashboard && npm run build && cd ..
firebase deploy --only database,functions,hosting
```

Cloud Functions require the Blaze (pay-as-you-go) plan; the usage of this project stays inside the free quota.

## 5. Firmware

1. Install Arduino IDE 2.x and add the ESP8266 boards URL
   `https://arduino.esp8266.com/stable/package_esp8266com_index.json` in *Preferences*.
2. Install the libraries listed in [hardware.md](hardware.md#firmware-build).
3. Copy `firmware/greenhouse_esp8266/config.example.h` to `config.h` and fill in Wi-Fi and Firebase values.
4. Select **NodeMCU 1.0 (ESP-12E Module)** and upload. Open the Serial Monitor at 115200 baud.

## 6. Python simulator (optional)

```bash
cd simulator
pip install -r requirements.txt
python esp8266_simulator.py --offline --steps 20 --csv run.csv          # offline test
python esp8266_simulator.py --database-url <DATABASE_URL> --api-key <WEB_API_KEY> \
       --email <DEVICE_EMAIL> --password <DEVICE_PASSWORD>                # sends data to Firebase
```

With the Firebase Emulator: `firebase emulators:start`, then
`python esp8266_simulator.py --database-url http://127.0.0.1:9000 --namespace <project-id>`.

## 7. Docker (optional)

```bash
cd dashboard
docker build -t smart-greenhouse-dashboard .
docker run -p 8080:80 smart-greenhouse-dashboard     # http://localhost:8080
```
