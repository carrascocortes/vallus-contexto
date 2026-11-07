param(
    [Parameter(Mandatory = $true)][string]$Titulo,
    [Parameter(Mandatory = $true)][string]$Texto
)

$ErrorActionPreference = 'Stop'

[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]

# Identificador de aplicativo do Windows PowerShell: o GUID da pasta System32 entre chaves, montado por partes.
$partesDoGuid = '1AC14E77', '02E7', '4E5D', 'B744', '2EB1AE5198B7'
$aplicativo = '{' + ($partesDoGuid -join '-') + '}\WindowsPowerShell\v1.0\powershell.exe'

$tituloXml = [System.Security.SecurityElement]::Escape($Titulo)
$textoXml = [System.Security.SecurityElement]::Escape($Texto)

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template=""ToastGeneric""><text>$tituloXml</text><text>$textoXml</text></binding></visual></toast>")

$notificacao = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($aplicativo).Show($notificacao)
