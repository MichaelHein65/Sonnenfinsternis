# Astronomische Berechnung

## Ereignissuche

Globale Sonnenfinsternisse werden mit `SearchGlobalSolarEclipse` und `NextGlobalSolarEclipse` aus Astronomy Engine gesucht. Das Ergebnis enthält Zeitpunkt des Maximums, Finsternistyp, Abstand der Schattenachse sowie – bei zentralen Finsternissen – geografische Koordinaten.

Lokale Ereignisse werden mit `SearchLocalSolarEclipse` für Breite und Länge des Beobachtungsortes berechnet. Daraus stammen Beginn, Maximum, Ende, Bedeckung und Sonnenhöhe.

## Lokale Sonnenscheibe

Für die gewählte Position werden die topozentrischen Rektaszensions- und Deklinationswerte von Sonne und Mond zur Simulationszeit berechnet. Aus Distanz und physischem Radius entstehen die beiden scheinbaren Winkelradien. Die relative Rektaszensions- und Deklinationsdifferenz steuert die Position der Mondscheibe vor der Sonne.

Die aktuelle Bedeckung wird aus der Schnittfläche zweier Kreise mit den jeweiligen scheinbaren Radien und ihrem Winkelabstand bestimmt. Die Sonnenhöhe stammt aus der lokalen Horizonttransformation. Die Himmelsansicht wird während der Animation alle 30 simulierten Sekunden aktualisiert.

## Bewegte Schattenachse

Für jeden Simulationszeitpunkt werden geozentrische Vektoren von Sonne und Mond berechnet. Die Achse des Mondschattens verläuft vom Mond von der Sonne fort. Diese Achse wird zunächst vom J2000-Bezugssystem in das wahre Äquatorsystem des Datums gedreht.

Die Erde wird als abgeplattetes Ellipsoid behandelt. Zur Schnittberechnung wird die Z-Achse so skaliert, dass das Ellipsoid zu einer Kugel wird. Die Geradengleichung der Schattenachse wird anschließend mit dieser Kugel geschnitten. Nach Rückskalierung entstehen geodätische Breite und Länge. Die geografische Länge berücksichtigt die Greenwich-Sternzeit und damit die Erddrehung.

## Schattenbahn

Die Bahn wird in Schritten von drei Minuten innerhalb eines Fensters von sieben Stunden um das Maximum abgetastet. Nur Zeitpunkte mit einem realen Schnittpunkt zwischen Schattenachse und Erdoberfläche werden dargestellt. Die Bedienzeitleiste selbst umfasst sechs Stunden.

## Sichtbarkeitsgebiet

Für den aktuellen Simulationszeitpunkt wird die Erdoberfläche in einem Drei-Grad-Raster abgetastet. Für jeden Punkt wird sein Abstand von der zeitabhängigen Mondschattenachse mit dem dortigen Radius des Halbschattenkegels verglichen. Punkte innerhalb des Halbschattens bilden die goldene Sichtbarkeitsfläche. Die Berechnung wird während der Animation in Zwei-Minuten-Schritten aktualisiert.

Bei totalen und ringförmigen Ereignissen liegen Sichtbarkeitsfläche und Zentrallinie gemeinsam vor. Bei rein partiellen Ereignissen schneidet die Kernschattenachse die Erde nicht; deshalb wird nur die Halbschattenfläche dargestellt.

## Kartendarstellung

Die Ländergrenzen stammen aus `world-atlas`. D3-Geo schneidet Polygone korrekt an der internationalen Datumsgrenze. Dadurch werden geografische Grenzen nicht fälschlich quer über den Globus verbunden.

## Grenzen

- Atmosphärische Refraktion wird in der globalen Schattenbahndarstellung nicht als eigenes Wettermodell simuliert.
- Gelände, Gebäude, Bewölkung und lokale Horizontabschattung sind nicht enthalten.
- Regionsnamen sind bewusst grobe, offline verfügbare Einordnungen.
- Sonnenaufgang und Sonnenuntergang werden mit der oberen Sonnenkante und atmosphärischer Refraktion berechnet. Die Ausgabe verwendet die offline aus den Koordinaten ermittelte IANA-Zeitzone des Beobachtungsorts.
- Die Anwendung ersetzt keine sicherheitskritische oder wissenschaftlich zertifizierte Beobachtungsplanung.
