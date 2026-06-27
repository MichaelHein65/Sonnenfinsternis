# Bedienung

## Start

Die Anwendung kann über `npm run dev` oder über den erzeugten macOS-Launcher gestartet werden. Der Launcher öffnet UMBRA ohne sichtbares Terminalfenster im Vollbildmodus.

## Sprache

Die aktuelle Sprache wird rechts oben über die Flagge ausgewählt. UMBRA speichert die Auswahl lokal im Browser. Zur Verfügung stehen zehn Sprachen, einschließlich Kroatisch. Arabisch wechselt die Oberfläche automatisch in Rechts-nach-links-Darstellung.

## Beobachtungsort

Über „Mein Standort“ wird der Ort für die persönliche Berechnung eingegeben. Während der Eingabe erscheinen passende Treffer mit Land. Die Suche toleriert fehlende Akzente, verbreitete internationale Schreibweisen und kleinere Tippfehler. Mit den Pfeiltasten wird ein Treffer markiert, mit der Eingabetaste übernommen und mit Escape verworfen. Das Ortsverzeichnis bleibt vollständig auf dem Mac; es wird kein Online-Kartendienst abgefragt.

Der lokale Bereich zeigt:

- Datum und Uhrzeit des nächsten sichtbaren Ereignisses
- Art der Sonnenfinsternis
- maximale Bedeckung
- Sonnenhöhe zum lokalen Maximum

Zusätzlich zeigt eine lokale Himmelsansicht Sonne und Mond zur aktuellen Simulationszeit. Die Mondscheibe bewegt sich maßstäblich vor der Sonne; aktuelle Bedeckung und Sonnenhöhe werden daneben laufend aktualisiert. Liegt die Sonne unter dem Horizont, wird die Darstellung abgedunkelt.

## Globus

Der Globus lässt sich mit der Maus drehen und über das Scrollrad vergrößern. Die goldene, transparente Fläche zeigt das zum aktuellen Zeitpunkt sichtbare Gebiet der Finsternis. Die orange Linie zeigt ausschließlich die berechnete Bahn des Schattenzentrums. Dezente Linien in der Kartentextur sind das geografische Gradnetz.

Bei rein partiellen globalen Ereignissen fehlt die orange Linie: Der Kernschatten verfehlt die Erde, während der Halbschatten weiterhin eine große partielle Sichtbarkeitszone erzeugt. Eine Erklärung am Globusrand weist darauf hin.

## Simulation

Die Zeitachse umfasst sechs Stunden: drei Stunden vor bis drei Stunden nach dem globalen Maximum. Wiedergabe und Geschwindigkeit werden unterhalb des Globus gesteuert. Außerhalb des Zeitraums, in dem die Schattenachse die Erdoberfläche schneidet, erscheint die Meldung „außerhalb der Erdoberfläche“.

## Ereignisse

Die Karten im Abschnitt „Zeitreise“ wechseln zwischen vergangenen und kommenden Ereignissen. Nach der Auswahl werden Datum, Region, Finsternistyp, Schattenbahn und Simulation neu berechnet.

## Tooltips

Erklärungsbedürftige Felder zeigen nach fünf Sekunden ruhigem Hover einen Hilfetext. Bei Tastaturbedienung erscheint der Tooltip unmittelbar beim Fokus.
