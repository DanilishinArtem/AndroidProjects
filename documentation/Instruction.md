# Instruction for emulator
## How to check and run emulator
We can do it by using Android Studio:
- `Vertual Device Manager` $\rightarrow$ `Play`

Or we can use terminal
- `emulator -list-avds`: check list of devices
- `emulator -avd Pixel_3a_API_34_extension_level_7_x86_64`: show info about emulated devices
- `emulator -avd emu`: run emulator

We can turn off emulator by using:
- GUI: `Power button (right side)` → `Power off` → `OK`
- By using ADB: `adb -s emulator-5554 emu kill`
- (If we have only one emulator) `adb emu kill`

`Note`: Also we can have not terminated process `VmmemWSL` - virtual machine of WSL, and we can terminate it to free RAM
- wsl --shutdown

## How to create the project by using `Expo framework`
- Run: `npx create-expo-app@latest --template bare-minimum`
It will prompt you asking to install create-expo-app pachage and then will ask you for the project name. A new directory will be created with the entered name.


## Running app by using emulator
We have a file `package.json` and we need to install dependences
- `npm install`

Then we can run our application
- `npm run android`

Structure:
- Application:
    - activities
    - services
    - broadcast receaver

## Debugging application
Building our application (one of two ways):
- npx expo run:android
- npx expo start (then we should press a)

Checking our logs:
- adb logcat | grep SnakeModule