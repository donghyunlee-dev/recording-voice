#define AppName "Voice Studio"
#define AppVersion "0.1.0"

[Setup]
AppId={{B53C8A9E-18B4-4D95-8CFD-F4D44BA0E31C}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Voice Studio
DefaultDirName={localappdata}\Programs\VoiceStudio
DefaultGroupName=Voice Studio
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
OutputDir=..\..\web\public\install\windows
OutputBaseFilename=VoiceStudioSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Voice Studio
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕 화면에 바로 가기 만들기"; GroupDescription: "추가 아이콘:"; Flags: unchecked

[Files]
Source: "..\..\local_runtime\*"; DestDir: "{app}\local_runtime"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "__pycache__\*,tests\*,*.pyc"
Source: "..\..\scripts\windows\*.ps1"; DestDir: "{app}\scripts\windows"; Flags: ignoreversion
Source: "..\..\requirements.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Voice Studio"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\windows\start-local-voice.ps1"" -InstallRoot ""{app}"""; IconFilename: "{sys}\imageres.dll"; IconIndex: 102
Name: "{autodesktop}\Voice Studio"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\windows\start-local-voice.ps1"" -InstallRoot ""{app}"""; IconFilename: "{sys}\imageres.dll"; IconIndex: 102; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "VoiceStudio"; ValueData: "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\windows\start-local-voice.ps1"" -InstallRoot ""{app}"""; Flags: uninsdeletevalue

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\windows\install-local-voice.ps1"" -InstallRoot ""{app}"""; Description: "Python과 Voice Studio 백엔드를 준비하고 실행합니다"; Flags: postinstall waituntilterminated

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\windows\uninstall-local-voice.ps1"" -InstallRoot ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "StopVoiceStudioBackend"
