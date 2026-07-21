#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <algorithm>
#include <cstdlib>
#include <string>

namespace {
constexpr WORD kCtrlScanCode = 0x1D;

WORD directionScanCode(char direction) {
    switch (direction) {
        case 'U': return 0x11;  // W
        case 'L': return 0x1E;  // A
        case 'D': return 0x1F;  // S
        case 'R': return 0x20;  // D
        default: return 0;
    }
}

bool sendScanCode(WORD scanCode, bool keyUp) {
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    input.ki.wScan = scanCode;
    input.ki.dwFlags = KEYEVENTF_SCANCODE | (keyUp ? KEYEVENTF_KEYUP : 0);
    return SendInput(1, &input, sizeof(INPUT)) == 1;
}
}  // namespace

int main(int argc, char** argv) {
    if (argc == 2 && std::string(argv[1]) == "--self-test") {
        return directionScanCode('U') == 0x11 && directionScanCode('R') == 0x20 ? 0 : 1;
    }
    if (argc < 2) {
        return 2;
    }

    const std::string code = argv[1];
    const DWORD delayMs = argc >= 3
        ? static_cast<DWORD>(std::clamp(std::atoi(argv[2]), 15, 250))
        : 45;

    for (char direction : code) {
        if (directionScanCode(direction) == 0) {
            return 3;
        }
    }

    if (!sendScanCode(kCtrlScanCode, false)) {
        return 4;
    }
    Sleep(delayMs);

    bool success = true;
    for (char direction : code) {
        const WORD scanCode = directionScanCode(direction);
        success = sendScanCode(scanCode, false) && success;
        Sleep(8);
        success = sendScanCode(scanCode, true) && success;
        Sleep(delayMs);
    }

    success = sendScanCode(kCtrlScanCode, true) && success;
    return success ? 0 : 5;
}
