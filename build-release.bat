@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set SDKROOT=%TEMP%\winsdk-extract
set INCLUDE=%SDKROOT%\cpp\c\Include\10.0.26100.0\um;%SDKROOT%\cpp\c\Include\10.0.26100.0\shared;%SDKROOT%\cpp\c\Include\10.0.26100.0\ucrt;%SDKROOT%\cpp\c\Include\10.0.26100.0\winrt;%SDKROOT%\cpp\c\Include\10.0.26100.0\cppwinrt;%INCLUDE%
set LIB=%SDKROOT%\x64\c\um\x64;%SDKROOT%\x64\c\ucrt\x64;%LIB%
set PATH=%SDKROOT%\cpp\c\bin\10.0.26100.0\x64;%USERPROFILE%\.cargo\bin;%PATH%
call npm.cmd run tauri build
