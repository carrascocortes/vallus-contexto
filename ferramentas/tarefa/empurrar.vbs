pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run """C:\Program Files\nodejs\node.exe"" """ & pasta & "\rodar.mjs""", 0, False
