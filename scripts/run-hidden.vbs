' LocalVault Silent Background Launcher
' Runs PowerShell scripts completely hidden without showing any console window on boot/logon.
Option Explicit
Dim WshShell, FSO, scriptDir, startupScript, cmd, i, extraArgs

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
startupScript = FSO.BuildPath(scriptDir, "startup-service.ps1")

extraArgs = ""
For i = 0 To WScript.Arguments.Count - 1
    extraArgs = extraArgs & " " & WScript.Arguments(i)
Next

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & startupScript & """" & extraArgs
WshShell.Run cmd, 0, False
