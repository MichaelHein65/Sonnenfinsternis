# Forumsbeitrag für Astrotreff

## Titel

UMBRA – Sonnenfinsternisse lokal auf dem Mac berechnen und simulieren

## Fertige Fassung zum Einfügen

Hallo zusammen,

ich möchte euch ein privates Projekt vorstellen, an dem ich in letzter Zeit gearbeitet habe: **UMBRA**, eine Browser-Anwendung zur lokalen Berechnung und Darstellung von Sonnenfinsternissen auf dem Mac.

Meine Motivation war, nicht nur fertige Tabellen oder Karten im Internet aufzurufen. Die Ereignisse und die Umstände für einen gewählten Beobachtungsort sollten direkt auf dem eigenen Rechner berechnet und anschließend anschaulich dargestellt werden.

[img]https://raw.githubusercontent.com/MichaelHein65/Sonnenfinsternis/main/assets/Start_Sonnenfinsternis.png[/img]

**Der derzeitige Funktionsumfang:**

• vergangene und kommende globale Sonnenfinsternisse  
• frei eingebbarer Beobachtungsort mit fehlertoleranter Ortssuche  
• Ermittlung der nächsten am gewählten Ort tatsächlich sichtbaren Finsternis – auch partiell  
• interaktiver 3D-Globus mit Sichtbarkeitsgebiet und Bahn des Schattenzentrums  
• zeitlich steuerbare Simulation vor und nach dem Maximum  
• lokale Darstellung von Sonnen- und Mondscheibe mit fortschreitender Bedeckung  
• Sonnenaufgang, Sonnenuntergang, Sonnenhöhe und örtliche Zeitzone  
• zehn Oberflächensprachen  
• macOS-Launcher ohne sichtbares Terminalfenster

Die astronomischen Berechnungen, Karten- und Ortsdaten laufen regulär lokal. Eine Verbindung zur OpenAI API wird ausschließlich optional verwendet, wenn man bei einer schwierigen oder stark fehlerhaften Ortsangabe ausdrücklich „Ort genauer suchen“ auswählt. Für die Berechnung der Finsternisse selbst ist sie nicht erforderlich.

Technisch basiert UMBRA unter anderem auf TypeScript, React, Three.js und Astronomy Engine. Der Quellcode und die Installationsanleitung befinden sich hier:

[url=https://github.com/MichaelHein65/Sonnenfinsternis]GitHub: MichaelHein65/Sonnenfinsternis[/url]

Der aktuelle Stand ist eine **Entwicklungs- und Testversion für macOS**. Voraussetzung sind derzeit macOS 12 oder neuer sowie Node.js 20. Gelände, Gebäude, Bewölkung und eine lokale Horizontabschattung werden nicht berücksichtigt. Das Programm ist deshalb als Planungs-, Informations- und Visualisierungswerkzeug gedacht.

Mich würde besonders eure fachliche Einschätzung interessieren:

• Sind die lokalen Umstände bei euren bekannten Orten und Ereignissen plausibel?  
• Ist die Darstellung von Sichtbarkeitsgebiet und Schattenbahn verständlich?  
• Welche Orte und Finsternisse sollte ich gezielt als Nächstes prüfen?  
• Wie verhält sich die Darstellung auf unterschiedlichen Macs?

Fehlerberichte und Verbesserungsvorschläge sind ausdrücklich willkommen – entweder hier im Thema oder über GitHub.

Viele Grüße  
Michael

---

## Bildunterschrift

Das UMBRA-App-Symbol greift die teilweise bedeckte Sonnenscheibe und die goldene Schattenbahn der Anwendung auf.

## Direkter Bildlink

https://raw.githubusercontent.com/MichaelHein65/Sonnenfinsternis/main/assets/Start_Sonnenfinsternis.png
