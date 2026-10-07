# a better Disneyland Paris App

PWA für Disneyland Paris, öffentlich ohne Login unter https://abetterdisneylandparisapp.weletapi.com/App/. Unter `/` steht die Einführung. Eigener Docker-Betrieb und sämtliche App-/Docker-Daten auf der SSD. Die alte Host-App ist archiviert; ihre Adresse ist stillgelegt und leitet nicht mehr weiter.

- Ride-Favoriten und besuchte Rides lokal auf dem Gerät gespeichert. Die neue Domain hat einen eigenen Browser-Speicher; bisherige Favoriten werden nicht automatisch übertragen.
- Gerichtetes OpenStreetMap-Fußwegenetz, Dijkstra für Teilstrecken, Besuchsreihenfolge immer nach dem nächstgelegenen verbleibenden Ride anhand der kürzesten Fußwegdistanz. Übersprungene Rides bleiben unbesucht und werden ans Ende gestellt; sie lassen sich jederzeit wieder aufnehmen und werden automatisch aktiv, sobald alle anderen Rides erledigt sind.
- Start am Parkeingang, manuell oder mit GPS. Toilettenstopp wird als nächstes Ziel fixiert und über minimalen Umweg zum nächsten Ride ausgewählt.
- Vollbild-Navigation folgt dem Live-GPS. Verschieben pausiert die Verfolgung; Standort folgen aktiviert sie wieder. Richtung aus absolutem Kompass oder Bewegung. Nächstes Ziel, Entfernung und danach folgender Stopp werden angezeigt. Besuche werden manuell bestätigt; „Für jetzt überspringen“ ist auch im Vollbild verfügbar.
- Offizielle Disney-Karte als zoombare Orientierung. Da sie nicht maßstabsgetreu ist, verwendet die Live-Navigation die geografische Wegekarte oder die neue geografische 3D-Parkkarte.
- Öffentlicher Controller ohne weletapi-Login, mit signierter Gerätekennung und CSRF-Prüfung für Änderungen. Apache im eigenen Container leitet App-Assets über eine exakte Allowlist. GPS/Sensorfreigabe nur nach Zustimmung.
- HTML, Session-Antworten und Navigationsrequests werden nicht offline zwischengespeichert. Öffnen/Neustart erfordert Verbindung. Geladene Route und Daten funktionieren offline. Öffentliche Kartentiles werden nicht vorab heruntergeladen; erfasste Fußwege bleiben sichtbar.

Quellen: © OpenStreetMap-Mitwirkende, ODbL, API-Stand 05.10.2026. © Disney, offizieller Disneyland-Parkplan März 2026. Ride-Zugänge sind angenähert, einzelne manuell korrigiert; aktuelle Sperrungen, Öffnungszeiten und Wartezeiten sind nicht enthalten. Kürzeste Teilstrecken gelten für das gespeicherte Wegenetz, nicht für unbekannte Sperrungen vor Ort. Daten einschließlich Zugänge müssen vor einer vor Ort verlässlichen Navigation geprüft werden.

## Lokal

`python3 -m http.server 8792 --directory dist`

`index.html` dient der lokalen Vorschau. Die öffentliche Produktion nutzt `docker/public-index.php` und `docker/public-runtime.php` ohne Host-Auth-Abhängigkeit. `dist/index.php` ist ausschließlich der historische, inzwischen stillgelegte Host-Controller.

## Prüfung

`node tests/routing.test.cjs`

GPS, iPhone-Kompass und Installation zusätzlich auf einem echten Handy im Park testen.

## Deployment

Aktueller Betrieb: `docker/deploy.sh` aus `/mnt/backup/docker-projects/disney-public/releases/build110`; öffentliche Domain über den bestehenden Cloudflare-Tunnel an `127.0.0.1:18081`. Container `disney-public-web`, Image `disney-public:build110`. Details und Prüfungen im Abschnitt „Öffentliche App in Docker“. Die früheren Host-Deployments unten dokumentieren die Entwicklungsgeschichte und werden nicht mehr verwendet.

## Standard-Favoriten

15 deduplizierte Ziele aus dem vom Nutzer gelieferten Drei-Tage-Plan, einschließlich Schloss-Rundgang, Drache, Alice-Labyrinth und Adventure Isle. Hyperspace Mountain wird nicht vorgewählt, da es im gelieferten Plan nur als Intensitätswarnung erwähnt wurde. Versionierte Standardliste wird beim ersten Öffnen dieses Updates einmalig zu bestehenden Favoriten ergänzt; spätere Änderungen bleiben erhalten. „Standardliste wiederherstellen“ stellt die Auswahl erneut her und bewahrt besuchte Ziele. Alle Einträge haben eine reversible Besucht-Checkbox; Routen lassen besuchte Ziele aus.

## Kartenrotation

Beide Karten lassen sich mit zwei Fingern drehen, am Desktop auch mit rechter Maustaste oder Umschalt + Mausrad. Drehbuttons erlauben 30°-Schritte; N richtet die Karte wieder nach Norden aus. Route, Zugänge und Standort bleiben geografisch ausgerichtet. Die Standortrichtung dreht mit der Kartenansicht. Lokal gebündelt: @tomickigrzegorz/leaflet-rotate 0.3.0 (MIT), Lizenz in dist/vendor/leaflet-rotate.LICENSE.
Lokale Kompatibilitätskorrektur: Renderer.onAdd verwendet this._map, wenn Leaflet 1.9.4 Canvas kein Map-Argument übergibt.

## Routen-Playlist

Antippen des Zielnamens in der Vollbild-Zielanzeige öffnet eine scrollbare Playlist über der Karte. Aktueller Stopp, Reihenfolge, Teilstrecken und Gesamtstrecke werden angezeigt. Besucht, Überspringen und Wieder aufnehmen aktualisieren die offene Liste sofort. Schließen kehrt zur laufenden Karte zurück.

## Aktuelle Wartezeiten

Queue-Times.com (https://queue-times.com/pages/api), beide Parks, feste Zuordnung für 34 Ziele; Schloss-Rundgang hat keinen Feed-Eintrag. Geschlossen ist ein eigener Status, fehlende Werte sind unbekannt. Angezeigte Wartezeiten beziehen sich auf die normale Warteschlange. Geschützter Endpunkt index.php?waits=1 ruft ausschließlich Park 4/28 ab, serverseitiger Cache 60 Sekunden, Aktualisierung im Browser jede Minute bei sichtbarer App und beim Wiederöffnen/Onlinegehen. Quelle aktualisiert ca. alle fünf Minuten. Ohne Netz, nach Abruffehler, bei fehlendem Zeitstempel oder Daten älter als 15 Minuten werden Werte als letzter Stand gekennzeichnet. Quelle und Zeitstempel sind sichtbar, Route bleibt nach Fußwegdistanz. Der Server erhält keine GPS-Daten und sendet keine Benutzerdaten an den Anbieter.

Prüfung: node tests/wait-times.test.cjs; php tests/wait-times.test.php. wait-preview.json ist ausschließlich eine lokale Vorschau mit echten Daten vom 05.10.2026 und wird nicht deployed.

Vorschläge zum Einschieben nutzen den Median der zuletzt beobachteten Wartezeiten (max. sechs Stunden), mindestens drei unterschiedliche Quell-Zeitstempel über mindestens zehn Minuten. Nur offene, unbesuchte, nicht übersprungene Favoriten werden vorgeschlagen, wenn die aktuelle Wartezeit mindestens halbiert und um mindestens 15 Minuten gesunken ist. Zusätzlicher Fußweg maximal zehn Minuten, netto mindestens fünf Minuten Zeitgewinn, Ride höchstens 1,2 km entfernt. Akzeptieren fixiert das Ziel als nächsten Ride (nach einer bereits eingeplanten WC-Pause), danach wird die nächste Entfernung wieder priorisiert. Ablehnen pausiert den Vorschlag für 15 Minuten. Ohne Vergleichsdaten werden keine ungewöhnlich-kurz-Vorschläge erfunden.

„Visit next“ in der Playlist fixiert einen beliebigen verbleibenden Ride als nächstes Ziel, auch wenn er zuvor übersprungen wurde. Eine eingeplante WC-Pause bleibt davor. Die Wahl wird pro Nutzer lokal gespeichert, übersteht GPS-Neuberechnung und Neuladen und endet beim Besucht-Markieren oder Überspringen. Die übrigen Ziele bleiben nach Fußwegdistanz geordnet.

Karten-Infofenster zeigen Wartezeit oder Status, Quellzeitstempel und Attribution. Offene Fenster aktualisieren sich mit jedem Sync und behalten ihren Ride auch bei GPS-Routenneuberechnung. Ziele ohne veröffentlichten Feed zeigen einen entsprechenden Hinweis.

Mit „Gehrichtung“ richtet sich die Wegekarte automatisch am Standortpfeil aus (Kompass, sonst GPS-Bewegungsrichtung). Die Auswahl bleibt pro User im Browser gespeichert. Ohne aktuelle Richtung bleibt die letzte Kartenorientierung erhalten. Norden, Drehknöpfe oder manuelles Drehen schalten den Modus aus.

Der aktive blaue Routenabschnitt liegt über späteren Abschnitten; der Navigationspfeil berücksichtigt die Kartenrotation. WC-Pausen minimieren den zusätzlichen Fußweg zum aktuellen nächsten Ride und behalten diesen Ride als Ziel nach der Pause bei.

Vor einer WC-Pause fragt die App „Bisheriges Ziel“ oder „Nächstes Ziel“. Die erste Wahl erhält den aktuellen Ride nach der Toilette; die zweite optimiert danach nach dem kürzesten Weg neu. Abbrechen lässt die Route unverändert.

Vorschläge bei ungewöhnlich kurzer Schlange bleiben auch bei manuell gewähltem Ziel und während/nach der WC-Pause aktiv. „Ja, wechseln“ ändert den nächsten Ride; „Bisheriges Ziel“ behält die Route und unterdrückt den Vorschlag 15 Minuten. Die WC-Pause bleibt bei einem Wechsel zuerst.

Der Server sammelt alle 5 Minuten per `/etc/cron.d/weletapi-disney-waits` über `collect-waits.php`. Daten liegen privat und dauerhaft unter `/var/lib/weletapi-disney-waits` (www-data, 0700). Es werden 30 Tage eindeutiger offener Ride-Messungen gespeichert; geschlossene Rides und veraltete neue Messungen zählen nicht. Normalwert: Median bei ähnlicher Paris-Tageszeit (±60 Minuten, mindestens 12 Messungen aus 2 Tagen); bis dahin Median der letzten 6 Stunden mit mindestens 3 vorherigen Messungen über 10 Minuten. Der aktuelle Messwert zählt nicht zum eigenen Normalwert. Keine Prozentzahl bei fehlender/Null-Basis, geschlossenen Rides oder veralteten Daten. Staffel: ≥+20 % rot, ≥+10 % orange, ≤−20 % grün, ≤−10 % gelb, sonst neutral.

Queue-Times veröffentlicht pro Park historische Allzeit-Durchschnittswerte unter `https://queue-times.com/parks/4/stats` und `/parks/28/stats`. Diese werden als Startbasis verwendet (klar als historischer Durchschnitt, nicht Median, beschriftet) und einmal täglich vom CLI-Sammler aktualisiert. Die gebündelte Datei `historical-baselines.json` stammt vom 05.10.2026. Reife eigene Werte zur passenden Tageszeit haben Vorrang; bei fehlenden Quellwerten bleibt der 6-Stunden-Vergleich als Übergang. Die kostenlose dokumentierte API liefert nur Live-Messungen.

Catalogue update (2026-10-05): 95 destinations = all 50 official attraction entries,
42 park entertainment entries (including seasonal and reserved viewing entries),
and 3 additional railroad stations. Sources are captured under `sources/`;
`python3 enrich-catalog.py` reproduces the merge and preserves original IDs/defaults.
Unspecified character locations use clearly labelled approximate land areas.

The default screen is a full-viewport map with bottom navigation. Functions open
as a sheet; the bottom bar hides during live navigation. Current showtimes are
proxied by the authenticated `index.php?shows=1` endpoint from ThemeParks.wiki,
cached for 60 seconds in the private wait-data directory. GPS never leaves the
browser. Suggestions require a fresh accurate in-park location, fresh feed,
known venue, a pedestrian distance <=800 m, start within 45 minutes and enough
time for walking plus a 3-minute buffer. Reserved viewing duplicates and shows
with only approximate area coordinates are excluded from nearby suggestions.
No unverified timetable is substituted when the upstream source is unavailable.
Local `shows-preview.json` and `wait-preview.json` are preview files, not deployed.

Web Push (2026-10-05): user explicitly approved transmitting open favorite IDs and
nearby destination IDs to weletapi and enabling a persistent one-minute check.
No GPS coordinates or Kimi profile fields are sent. Context expires after 15 min;
notifications are deduplicated and limited to one every 15 min per device. Closed,
old or unreachable show times and stale queue data are excluded. Browser opt-in
is still required. Each push displays a visible notification; tap opens the named
attraction without silently switching the route. A test-send button verifies the
actual device after opt-in. Endpoint API requires an active signed-in account,
session CSRF token and same-origin POST; delivery URLs are allowlisted.

Private runtime: `/var/lib/weletapi-disney-push` (VAPID keys, subscriptions,
web-push 3.6.7 dependency, sender, collector lock). Public assets contain no private
key. Production job: `/etc/cron.d/weletapi-disney-push`. The `enabled` marker gates
registration and data transmission. Subscription deletion disables that device.
Onboarding v2 presents installation first, then location/push permissions. An
already installed standalone app proceeds directly to permissions; unsupported
browser installs have instructions and an explicit browser-only fallback.

Kimi: age 7, height 126 cm. Official catalogue minimum heights are displayed in
lists, map popups and playlists; intense rides are qualified in their details.
Autopia shows accompanied access below 132 cm. This compares entry size rules,
not whether Kimi will enjoy an intense ride; on-site boarding rules prevail.

### Top Rides und Onboarding (05.10.2026)
- `ratings.js` enthält einen datierten ExploreThemeParks-Besucherbewertungsstand für 39 eindeutig zugeordnete Attraktionen. Rangfolge: Note absteigend, bei Gleichstand Bewertungszahl. Standardmäßig mindestens 10 Bewertungen; kleine Stichproben lassen sich zuschalten. Keine erfundenen Noten für fehlende Daten. Quellen und Stand stehen in der Ansicht; keine automatische Aktualisierung dieser Noten.
- Die neue untere Navigation „Top Rides“ erlaubt das Hinzufügen über die vorhandene Favoritenlogik; GPS bleibt in den Kartenwerkzeugen und Funktionen erreichbar.
- Onboarding verwendet ein eigenes Vollbild-Overlay. Überspringen schließt unabhängig von Push und Service-Worker-Bereitschaft. Push abonniert unmittelbar im Klickereignis, mit Zeitlimit und sichtbarem Fehlerstatus. JS/CSS-URLs und Service-Worker-Cache haben Version 21 gegen veraltete Skripte; Registration nutzt `updateViaCache: none`.
- Tests: `tests/ratings.test.cjs`, `tests/onboarding.test.cjs` und gesamte Node-Testsuite erfolgreich. Im mobilen Browser: Installation zuerst, Überspringen zur Karte, Rangliste, Favorit hinzufügen und Persistenz nach Reload verifiziert. Echte iPhone-Push-Zustellung muss über „Test senden“ auf dem Gerät geprüft werden.

### Tab-Navigation während der Route (Build 24)
- Untere Navigation bleibt im Live-Navigationsmodus verfügbar; Map-only Browser-Fullscreen entfällt, damit die Tabs erreichbar bleiben. Route, GPS-Watch und Ziel bleiben beim Wechsel aktiv. Der Ziel-Player erscheint auf der Karte; die anderen Ansichten zeigen ihre Inhalte darüber.
- Favoriten / Alle / Top Rides behalten getrennte Filter, Suche und Scrollpositionen während der App-Sitzung. Neues Route-SVG statt Listenzeichen.
- Gehrichtungsmodus zentriert die Karte bei GPS-Updates auch ohne aktive Route. Manuelles Verschieben deaktiviert sowohl Folgen als auch Gehrichtung und speichert das ausgeschaltete Richtungssetting.
- Neue Regressionstests: `tab-navigation.test.cjs`; ergänzte `orientation.test.cjs`. Gesamte Node-Testsuite bestanden. Im mobilen Browser Tab-Wechsel, getrennte Suchfilter und Route-Berechnung geprüft.

### Parkmodus, Show-Info, Ride-Klicks (Build 26)
- Persistierter globaler Parkmodus (Disneyland Park / Disney Adventure World / beide) filtert Kartenmarker, Listen, offene Routenziele, Show-Nähe und Push-Kandidaten. Favoriten bleiben in beiden Parks erhalten. Parkmodus ist erst nach vollständigem Laden bedienbar, damit frühe Klicks keine leeren Favoriten speichern.
- Show-Bubble auf der Karte entfernt. Shows sind unter dem neuen Info-Tab abrufbar oder werden per aktiviertem Push gemeldet. Keine automatischen Show-Overlays.
- Kompass zeichnet höchstens alle 200 ms Richtung/Standort und ruft nicht mehr renderNav auf jedem Sensorereignis auf. Während Touch/Pointer-Eingaben werden automatische Rotation, Zentrierung und Routen-Neuberechnung kurz zurückgestellt. Kartenwerkzeug-Container fängt keine Klicks in Leerflächen ab.
- Kartenmarker haben verständliche Labels; Popups und normale Routenliste bieten Visit next. Ein bereits aktuelles Ziel ist in der Routenliste deaktiviert. WC-Pause bleibt beim Wechsel vorgereiht.
- Mobile Browserprüfung: Phantom-Manor-Popup geöffnet, Info-Tab geöffnet, exklusiver Parkmarkerfilter, Visit next für Spider-Man setzt ihn an Position 1. Gesamte Node-Suite bestanden; zusätzliche park-touch.test.cjs prüft Parkpersistenz/Favoritenerhalt und ruhige Kompassupdates.

### Show-Push-Zoom, kompakter Hinweis, Gehzeit (Build 27)
- Push-Klick sendet an eine bereits offene App eine Service-Worker-Nachricht, statt die laufende Route durch einen Reload zu unterbrechen. Bei geschlossener App öffnet weiterhin die notice-URL. focusRideOnMap zoomt auf das Ziel (Zoom 18) und öffnet das identische Marker-Popup; Route und Parkmodus bleiben erhalten, ein explizit geöffnetes Ziel außerhalb des Modus wird vorübergehend eingeblendet. Kartenfolgen/Heading wird beim bewussten Betrachten ausgestellt.
- Wieder ein sehr kleiner einzeiliger Show-Hinweis ganz oben: Name, Startzeit, Gehminuten. Der Button bleibt bei Datenaktualisierungen bestehen. Antippen fokussiert die Show auf der Karte; Info-Tab und Push bleiben nutzbar.
- Popups zeigen Gehzeit auf dem Fußwegenetz vom frischen GPS-Standort. Ohne frischen Standort ist der verwendete Planungsstart ausdrücklich angegeben. Bei GPS-Updates aktualisiert sich die Gehzeit eines offenen Popups.
- notice-focus.test.cjs prüft Ziel-Zoom/Popup, erhaltene Route, ausstehende Initialisierung, bestehende Client-Nachricht und den stabilen Hinweis mit Gehminuten. Gesamte Node-Suite bestanden. Mobil geprüft: notice-URL für Animation Academy öffnet Popup mit Gehzeit.

### Vollbild-Seiten und getrennte Kartensteuerung (Build 28)
- Listen, Favoriten, Top Rides, Route und Info sind eigene bildschirmfüllende Tab-Seiten. Navigation und individuelle Tab-Zustände bleiben aktiv. Kompakte Suche, Filter und Zeilen lassen mehr Ergebnisse sichtbar; die Standardliste lässt sich in Info wiederherstellen.
- Suche berücksichtigt auch Parknamen sowie Studios. VisualViewport passt Seitenhöhe an die Bildschirmtastatur an; dabei wird die Menüleiste ausgeblendet. Fertig und Enter schließen die Tastatur.
- Kartensteuerung in getrennten Bereichen mit Safe-Area-Abständen: Zoom rechts oben, Start/Park links, kompakte Richtungssteuerung rechts darunter. Bei niedrigen Bildschirmen entfallen zusätzliche Dreh-/Heading-Schalter. Gedrehte Karte und Liste bei 390 × 844 im Browser geprüft; sämtliche 14 Node-Testdateien bestanden.

### Zielkarte und mobile Kartenknöpfe (Build 29)
- Zielplayer sichtbar auf der Karte bei berechneter Route, unabhängig vom Live-Navigationsmodus. Wechsel zu anderen Tabs blendet ihn aus, Rückkehr stellt ihn wieder her. Explizites Schließen bleibt wirksam; Visit next und neue Routenberechnung öffnen ihn wieder. Beim Start wird die gespeicherte Favoritenauswahl direkt eingeplant.
- Menüleiste nur 6 px vom unteren Rand, Zielplayer direkt darüber. Plus/Minus auf Mobilgeräten verborgen; Richtungs-/Standortknöpfe rechts oben. Pinch-Zoom bleibt erhalten.
- 15 Node-Testdateien bestanden. Mobile Browserprüfung: Zielkarte sichtbar, Skip wechselt zum nächsten unbesuchten Ziel; Karte und Bedienelemente bleiben getrennt.

### Navigation mit ✕ beenden (Build 30)
- ✕ beendet die Route samt Zielfenster, Linien, WC-Zwischenstopp, automatischem Folgen und Heading-Modus. Standort bleibt für Karte/Shows nutzbar; Favoriten und Besuchsstatus bleiben gespeichert.
- Explizites Ende bleibt beim Neuladen bestehen. Neue Route/Visit next setzt den Zustand zurück. Laufende Worker-Berechnungen werden über den Generation-Zähler verworfen; Assemble-Ergebnisse werden erst nach Gültigkeitsprüfung übernommen.
- Alle 15 Node-Testdateien bestanden, einschließlich vollständigem Stop-Zustand und gespeicherter Beendigung.

### Glas-Menü über randfüllender Karte (Build 31)
- Leicht transparente Menüfläche mit WebKit-/Standard-Backdrop-Blur und dezenter Umrandung. Karte bleibt hinter der Leiste sichtbar.
- Standalone-PWA verlängert Karte und Workspace um den unteren Safe-Area-Inset. Menü wird um den überschüssigen Inset abgesenkt, mit 20 px Reserve für den Home-Balken; Zielplayer bleibt darüber.
- Mobile Browseransicht bei 390 × 844 visuell geprüft. Physischer iOS-Safe-Area-Inset ist im Desktop-Browser nicht reproduzierbar.

### Einheitliche leichte Glasflächen (Build 32)
- Kartenknöpfe, Kartenwahl, Standort-/Parkauswahl, Show-Hinweis, Beschriftung, Zielplayer, Marker-Popups und Dialoge teilen transparente Flächen mit WebKit-/Standard-Blur, heller Umrandung und dezentem Schatten.
- Tab-Seiten, Suche, Filter und sekundäre Aktionen leicht durchscheinend; primäre Aktionen behalten kräftigen Blaukontrast. Ohne Backdrop-Filter dichterer Hintergrund für Lesbarkeit.
- Karte und Phantom-Manor-Popup bei 390 × 844 visuell geprüft.

### Sichtbarer Viewport statt negativer Safe-Area-Verschiebung (Build 33)
- Build-31-Standalone-Verschiebung zurückgenommen: Auf dem Nutzergerät blieb der Systemstreifen erhalten und die Menüleiste wurde abgeschnitten.
- Workspace/Karte nutzen die gemessene VisualViewport-Höhe. Menüposition basiert auf sichtbarer Höhe und tatsächlicher Menühöhe (ResizeObserver), 6 px vom sichtbaren Rand. Zielplayer und Beschriftung berücksichtigen die tatsächliche Menühöhe.
- WebKit 301994 berichtet über nicht durch DOM erreichbare Systembereiche in Home-Screen-PWAs (iOS 26.5.2/27); ohne Gerätemessung ist dies eine plausible Ursache, keine bestätigte Versionsdiagnose. Keine Zusage, dass CSS diesen Systembereich füllen kann.
- Alle 15 Node-Testdateien bestanden. Browser bei 390 × 844: Kartenunterkante 844, Menüunterkante 838, keine abgeschnittenen Buttons.

### Versionsprüfung und iPhone-Statusleistenmodus (Build 34)
- Info zeigt laufenden Build und aktuellen Server-Build. Authentifizierter, nicht gecachter version-Endpunkt liest die Versionsnummer aus index.html. Prüfung beim Start, im Info-Tab, bei Rückkehr in den Vordergrund und alle zwei Minuten; neue Version wird einmal angekündigt.
- App neu laden/Update installieren prüft die Verbindung, aktualisiert den Service Worker und öffnet die App mit Cache-Buster. Keine Löschung von Favoriten, LocalStorage oder Push-Abonnement. Bei fehlgeschlagener Prüfung bleibt die offene App erhalten.
- apple-mobile-web-app-status-bar-style auf default geändert: WebKit 236445 beschreibt unter black-translucent einen zusätzlichen unteren Abstand in Höhe des oberen Insets. Workaround mit eigenem Statusleistenbereich oben; physischer iPhone-Neustart zur Bestätigung nötig, kein nachgewiesener Fix aller iOS-Versionen.
- Node-Test für Versionsvergleich, einmalige Meldung, Offline-Erhalt, SW-Update und Cache-Buster bestanden. Mobile Browser: Info zeigt App-Version 34 / Server 34; Update-Knopf führt tatsächlich zum neuen Dokument.

### Kompakter Player mit Ziehgriff (Build 35)
- Zielkarte standardmäßig kompakt: Ride maximal zwei Zeilen, Gehzeit, Skip, WC und Besucht direkt sichtbar. Danach/GPS/Quelle/Folgen unter Mehr; Playlist über Ride-Namen. Vorschläge im aufgeklappten Player und in der Playlist.
- Ziehgriff per Pointer-Capture: nach unten minimieren, nach oben öffnen; Antippen als Alternative. Nach einer Ziehgeste erzeugter Klick darf die Größenänderung nicht umkehren. Mini-Player zeigt Ride/Gehzeit/Skip/Beenden, weitere Aktionen bleiben nach Öffnen verfügbar.
- Browser mit langem Avengers-Namen bei 390 × 844: normale Höhe 166 px, minimiert 76 px. Echte Drag-Geste erfolgreich; Details aufklappbar. 17 Node-Testdateien bestanden.
- Passive Toasts blockieren keine Menüknöpfe mehr und sitzen oberhalb der Menüleiste.

### Nur aktueller Weg ab aktuellem Start (Build 36)
- renderLines zeichnet ausschließlich den ersten Wegabschnitt (weiße Kontur/blau), keine Verbindung zu späteren Stopps. Playlist/Reihenfolge bleiben vollständig. Kartenausschnitt-Button zeigt nur den Weg zum nächsten Ziel.
- Bei jedem gültigen GPS-Update wird der erste Abschnitt sofort vom aktuellen Start über das Fußwegenetz zum aktuellen Ziel erneuert, einschließlich Gehzeit und Distanz. Pfad beginnt exakt am Standort; kurzer Anschluss zum nächsten Graphknoten bleibt enthalten.
- Optimierung hält ihren ursprünglich verwendeten Start fest: GPS-Änderungen während der Worker-Berechnung werden nicht mehr fälschlich als bereits berechneter Start gespeichert.
- Alle 17 Node-Testdateien bestanden. Navigation-display prüft nur zwei Linien (Kontur+aktive Linie), bewegten Start, aktuelle Gehstrecke und Entfernung alter Startabschnitte. Browser zeigt ausschließlich den aktiven Weg zu Avengers.

### Eindeutige Show-Ziele (Build 37)

Angeklickte Shows erhalten einen größeren goldenen Marker und ein dauerhaftes Namensschild. Das aktuelle Show-Ziel der Route ist als „NÄCHSTE SHOW“ beschriftet, eine separat ausgewählte Show als „AUSGEWÄHLTE SHOW“. Die Markierung bleibt nach dem Schließen des Infofensters sichtbar; beim Wechsel wird die bisherige Auswahl zurückgesetzt.

### Freie Wege über Plätze (Build 38)

Das Wegenetz enthält nun Verbindungen quer über 33 kartierte Fußgängerflächen innerhalb des Navigationsbereichs. Gebäude, Beete, Wasser, Flächenlöcher sowie kartierte Mauern, Hecken und Zäune werden ausgespart. Nur vollständige OSM-Geometrien auf Bodenhöhe mit erlaubtem Fußzugang werden verwendet. Ein 10-Meter-Raster verbessert die Zuordnung des aktuellen Standorts auf offenen Flächen. Die bestehenden Ride-Zugänge und gespeicherten Favoriten bleiben erhalten.

Reproduzierbar: Python-Umgebung mit `pip install -r requirements-plazas.txt`, dann `python prepare-plazas.py`. Der Generator entfernt vorangehende Ergänzungen anhand der gespeicherten Basisgrößen und prüft jede zusätzliche Strecke gegen die begehbare Geometrie. Für größere Flächen werden nahe sichtbare Nachbarn verbunden; die ermittelte Strecke ist die kürzeste im ergänzten Wegenetz. Aktuelle mobile Absperrungen müssen weiterhin vor Ort beachtet werden.

Prüfung: `python tests/plazas.test.py` prüft freie Platzquerung und Hindernis-Aussparung. `node tests/plaza-routing.test.cjs` prüft den konkreten Umweg am Place des Stars: Spider-Man-Zugang etwa 89 statt 328 Meter, alle 95 Ziele weiterhin erreichbar. Versionierte Datendatei wird ohne Browser-HTTP-Cache geladen.

### Kompakte Kimi-Info (Build 39)

Listen, Route-Playlist und Karten-Infofenster zeigen die Kimi-Info nur bei unterschrittener Mindestgröße, weiterhin rot. Passende Größen und unbekannte Regeln erzeugen kein zusätzliches Badge.

### Ride-Listen nach Entfernung (Build 40)

Favoriten, Alle und Top Rides lassen sich nach Fußwegentfernung, Bewertung oder Name sortieren. Entfernung ist die Standardauswahl und enthält den Weg im aktuellen Wegenetz plus Start-/Zugangsabstand. Jede Zeile zeigt Meter und Gehminuten; der Bezugspunkt steht über der Liste. Ohne Live-GPS gilt der gewählte Start bzw. Parkeingang. Unerreichbare Ziele stehen hinten und haben keine erfundene Gehzeit. Top Rides behält die bisherige Bewertungsauswahl; die Sortierung wird je Tab beim Wechsel bewahrt. Akzeptierte GPS-Positionen aktualisieren eine sichtbare Liste höchstens alle sechs Sekunden außerhalb aktiver Karteninteraktionen.

### Besuchte ausblenden (Build 41)

Favoriten, Alle und Top Rides blenden besuchte Ziele standardmäßig aus. „Besuchte anzeigen“ blendet sie wieder ein und ermöglicht das Entfernen eines Besuchs-Häkchens. Die Filterwahl bleibt je Tab beim Wechsel erhalten; gespeicherte Besuchsmarkierungen werden nicht verändert.

### Check-in und Restwartezeit (Build 42)

„Check-in · Anstellen“ in Ride-Liste, Kartenfenster und Zielanzeige startet nach Bestätigung einen lokal gespeicherten Wartezeit-Timer. Frische offene Feed-Wartezeiten werden übernommen; die Eingangsanzeige kann manuell eingetragen werden. Restzeit = Schätzung beim Check-in minus vergangene Zeit. Spätere Feed-Wartezeiten gelten für neu Ankommende und ersetzen diese Ausgangsschätzung nicht. Ohne Zahl wird nur die gewartete Zeit gezeigt; bei abgelaufener Schätzung wird kein sofortiger Einlass versprochen. „Eingestiegen · Ride besucht“ beendet den Timer und markiert den Ride besucht; Abbrechen beendet nur den Timer. Wiederöffnung über Info → Meine Wartezeit. Zustand bleibt bis zu 24 Stunden erhalten, auch nach Neuladen.

Fünf Minuten kontinuierliche GPS-Nähe (max. 40 m zum erfassten Ride-/Zugangspunkt, Genauigkeit ≤30 m) lösen einmal je Attraktion und Pariser Kalendertag eine Check-in-Frage aus. Ungültige Fixes, Parkwechsel/anderes Ziel oder GPS-Lücken >45 Sekunden setzen die Beobachtung zurück. Besuchte Attraktionen und bereits laufender Check-in sind ausgeschlossen. Mit erteilter Benachrichtigungsfreigabe wird lokal über den Service Worker eine Mitteilung angezeigt; Antippen öffnet den Check-in. Ohne Freigabe erscheint eine Frage in der App. Ohne GPS-Updates bzw. bei pausierter iPhone-PWA kann kein verlässlicher Hintergrund-Aufenthalt erkannt werden. Keine zusätzlichen GPS- oder Timerdaten werden an weletapi übertragen.

### Check-in bei Ankunft (Build 43)

Bei akzeptierter GPS-Position (Genauigkeit ≤30 m) innerhalb von 25 m zum erfassten Ride-/Zugangspunkt des aktuellen Routenziels bietet die App sofort den Check-in an. Der Ankunftshinweis erscheint direkt in der App. Ein fünfminütiger Aufenthalt bei einer anderen Attraktion löst weiterhin den bisherigen Hinweis aus. Beide verwenden dieselbe tägliche Meldungssperre; besuchte Ziele, laufender Check-in und offene Dialoge unterdrücken Hinweise.

### Kompakte Wartezeit-Karte (Build 44)

Die Check-in-Anzeige ist eine kleine, nicht modale Glass-Karte über der Menüleiste. Sie ersetzt die Zielkarte solange sie offen ist; Tabs und Karte bleiben bedienbar. Erklärung unter Details; Eingestiegen und Abbrechen in einer Zeile. 16-px-Zahleneingabe verhindert automatisches iPhone-Zoomen bei der Eingabe.

Object information: tap a ride name in any list or a marker on the map. The compact details show land/type, verified catalogue height rules, available wait/rating and walking time, plus sourced coaster specifications. RCDB checked on 2026-10-05: Flight Force has a published 5 g value; other coasters explicitly show missing G-force values. No values inferred from coaster models or copied from other parks. Links to the specific RCDB record and official Disney page are visible.

Build 45: actual elapsed check-in time is primary, ticking every second from the persisted start timestamp and continuing beyond the estimate. Boarding records elapsed milliseconds locally and shows the final duration in confirmation and ride object details. Aborting does not record a completed wait.

Build 46: separate Single Rider queue times in lists, playlists, object details, map popups and current destination. Nine explicit Queue-Times IDs verified against source feeds. Existing minute sync and per-queue baselines apply independently, with closed/missing/stale states preserved. Standard queue remains used for default check-in estimates and family opportunity suggestions.

Build 47: tap route or playlist names / non-action row areas to open all available object details, preserving visit/skip buttons. Compact scrollable sheet contains sourced wait comparisons, both queues, rating, location qualification, walk distance, saved actual wait and selection state, with a distinct official Disney link. Shows include all published slots for today in Paris local time, sorted/deduplicated, past/running/upcoming labels, and explicit missing/stale/closed status; opening refreshes the source.

Build 48: Favorites has an explicit visited action alongside the existing checkbox, using completion logic to remove visited rides from the route and clear pending priority/defer/check-in state. With “Besuchte anzeigen”, “Wieder offen” restores the ride. Favorite hearts stay selected.

Show schedules now hide past start times older than 15 minutes, while keeping any currently running performances. Boundary at exactly 15 minutes remains visible.

Build 49: nearby show dialog entries now open the same object info sheet on name/row taps. Visit next retains its independent action; closing details returns to the nearby list.

## Bedienung · Build 50

Fünf feste Bereiche: Karte, Favoriten, Entdecken, Route und Info. Top Rides ist eine
Auswahl innerhalb von Entdecken. Suchtext, Sortierung, geöffnete Filter und Scrollposition
bleiben pro Ansicht erhalten; ein Tabwechsel beendet die laufende Navigation nicht.
Die Karte zeigt Suche, Standort, Gehrichtung und Karteneinstellungen als kompakte
Werkzeugleiste. Kartentyp, Kartenfilter, manuelles Drehen und Routenübersicht sind
in den Einstellungen erreichbar. Besuchte Kartenmarker sind standardmäßig ausgeblendet.
Ride-Zeilen zeigen Name, Gehzeit, Bewertung und getrennte Wartezeiten. Check-in und
weitere Fahrdaten stehen in der gemeinsamen Detailansicht; Favoriten lassen sich
weiter direkt als besucht markieren. Detailansichten ersetzen eine offene Playlist
oder Showliste vorübergehend und stellen sie beim Schließen wieder her.
Das nichtmodale Check-in-Fenster liegt außerhalb des Karten-Stacking-Kontexts,
damit es auch über den Listen sichtbar ist. Bedienflächen haben überwiegend mindestens
44 Pixel; die Tab-Leiste berücksichtigt den Home-Indikator, die Karte läuft dahinter weiter.

Designgrundlagen: Apple HIG Tab bars, Sheets und Accessibility; öffentliche App-Store-
Ansichten von Disneyland Paris sowie die offiziellen App-Beschreibungen von Europa-Park
und Universal Orlando. Kein Nachbau der Original-Apps.
https://developer.apple.com/design/human-interface-guidelines/tab-bars
https://developer.apple.com/design/human-interface-guidelines/sheets
https://developer.apple.com/design/human-interface-guidelines/accessibility
https://apps.apple.com/fr/app/disneyland-paris/id396908589
https://www.europapark.de/de/freizeitpark/infos/media-unterhaltung/europa-park-rulantica-app
https://www.universalorlando.com/web/en/us/landing-page/mobile-app

Prüfung: `node --test Disneyland/tests/*.test.cjs`; Browserabläufe bei 390 × 844,
320 × 568 und Desktop prüfen. Echte iPhone-Sensoren, Push-Zustellung und die native
Bildschirmtastatur brauchen weiterhin eine Prüfung auf dem Gerät.

## Disney-Infos vorab speichern · Build 51

„Disney-Infos“ in der Objektansicht öffnet eine native, lokal gespeicherte Faktenansicht.
Sie enthält die Basisangaben für alle 95 katalogisierten Ziele sowie verfügbare Services
und Zugangshinweise aus den öffentlichen Detailseiten. Die Originalseite bleibt über
einen gesonderten Link erreichbar. Quellendatum und fehlende Detailangaben sind sichtbar.
Die vollständige Disney-Website, Bilder und Tracking-/Buchungsskripte werden nicht gespiegelt.

`sources/official-page-facts.json` enthält den gelesenen Stand der öffentlichen Seiten;
`python3 Disneyland/prepare-disney-guide.py` erzeugt daraus zusammen mit dem Verzeichnis
das kleine `dist/disney-guide.js`. Nur erkannte Fakten werden übersetzt; bedingte oder
unbekannte Formulierungen werden nicht als Zugangsfreigabe interpretiert. Seitentitel und
Quellendomäne müssen passen. Die Inhalte werden bei einer neuen App-Version aktualisiert,
nicht als Live-Daten ausgegeben. Wartezeiten und Spielzeiten bleiben in ihren Live-Feeds.

Der Guide wird vor `app.js` geladen und beim Service-Worker-Installieren vorab gespeichert.
Für die aktuelle Versions-URL wird er aus dem Cache gelesen, ohne die Antwort des Netzes
abzuwarten. Eine bereits offene App zeigt die Infos deshalb auch bei Verbindungsabbruch.
Ein erneutes Öffnen der App erfordert weiterhin die weletapi-Anmeldung und Netzverbindung;
Login-Seiten, Navigationsantworten und private Nutzerinformationen werden nicht gecacht.

## Kartenfläche und sichtbare Bedienelemente · Build 54

HTML und App-Body verwenden die volle Viewport-Höhe (`100vh`/`100lvh`) statt `100%`.
Das vermeidet einen zu kleinen Wurzelcontainer im iOS-Standalone-Modus; ein größerer
Kartencontainer allein repariert diesen nicht. Die Karte verwendet die vollständige
Layout-Höhe. Ein unsichtbares CSS-Viewport-Maß
(`100dvh`, in Standalone `100lvh`) wird zusammen mit Layout-Viewport und innerHeight
ausgewertet. Im installierten Vollbildmodus verwenden die Bedienelemente die tatsächliche
Höhe des App-Bodys. iOS kann nach der Root-Korrektur noch eine zu kleine innerHeight/
Visual-Viewport-Höhe melden, obwohl die Karte bereits den ganzen Bildschirm ausfüllt.
Ein weiterhin kleiner Body bleibt geschützt; das CSS-Probe-Maß allein verschiebt das Menü
nicht nach unten. Im Browser und bei Tastatur verwenden die Bedienelemente die kleinere
sichtbare Fenster-/Visual-Viewport-Höhe. Der Höhenunterschied wird bei im Kartencontainer
positionierten Elementen zusätzlich abgezogen. Ein nach Tastaturende zurückgebliebener
Visual-Viewport-Offset verschiebt das Menü nicht nach unten. Beim Orientierungswechsel
darf die Kartenhöhe wieder kleiner werden; eine reine Tastaturänderung baut die Karte
nicht neu auf. Bei neuer Kartenhöhe wird Leaflet nach dem Layout aktualisiert.

Der zusätzliche Rand unter der Tab-Leiste beträgt 4 px. Bei einer Home-Indikator-Safe-Area
bleibt deren Höhe abzüglich 12 px als kleiner Schutzabstand. Falls die sichtbare Fläche
bereits oberhalb dieses Systembereichs endet, wird der Abstand nicht doppelt ergänzt.
Die iOS-Vollbild-Metainformation
nutzt `black-translucent` zusammen mit `viewport-fit=cover`, um die Karte unter den
Systemrändern zeichnen zu lassen. Die Darstellung auf einem echten iPhone muss nach
App-Update und vollständigem Neuöffnen geprüft werden.

Regressionsprüfung umfasst insbesondere eine 852 px hohe Kartenfläche bei nur 793 px
sichtbarem Bereich sowie denselben JS-Messwerten bei vollständig gerendertem 852 px Body,
verkürzte und versetzte Visual Viewports, unabhängige
Kartenhöhe bei Tastatur, Browser ohne VisualViewport und Querformat. Mobile
Browservorschau: 390 × 844, 320 × 568 und 844 × 390, Karte jeweils bis zum unteren Rand,
keine horizontale Überbreite, Menü und Zielkarte mit getrennten Abständen.

Referenz zum Root-Höhenfehler: https://github.com/openchamber/openchamber/issues/2287.
Die iOS-Installationskonfiguration kann ältere Statusbar-Metadaten behalten, siehe
https://bugs.webkit.org/show_bug.cgi?id=316008. Deshalb beweist eine Chromium-Vorschau
die iPhone-Systemränder nicht; dort ist die Prüfung nach Relaunch erforderlich.

## Kartenquellen am unteren Rand · Build 55

Die Kartenquelle steht einmal als 14 px hohe Zeile direkt am unteren Kartenrand,
mit einem Link zu OpenStreetMap bzw. zum Disney-Originalplan. Die zusätzliche
Leaflet-Attributionszeile entfällt. Der Tab-Rand reserviert nur diese Zeile und 2 px
Abstand, sofern der Home-Indikator nicht ohnehin mehr Platz benötigt. Die frühere
frei schwebende Quellenanzeige oberhalb des Menüs entfällt.

## Nicht interessiert · Build 56

- Im gemeinsamen Detailfenster für Rides, Shows und Figurenbegegnungen gibt es „Nicht interessiert“. Die IDs werden im bestehenden nutzerbezogenen Browserzustand gespeichert; ältere Zustände starten ohne ausgeblendete Ziele.
- Ausgeblendete Ziele verschwinden aus Entdecken, Top Rides, Favoriten, Kartenmarkern, Routen und neuen Nähe-/Check-in-Hinweisen. Aktuelles Ziel, Priorität und offene Kartenfokussierung werden entfernt, die aktive Route wird neu berechnet. Ein bereits laufender Wartezeit-Timer und die Favoritenzuordnung bleiben erhalten.
- Unter Info → Nicht interessiert lassen sich Ziele einzeln wieder anzeigen. „Besuchte anzeigen“, Parkwechsel und Standard-Favoriten wiederherstellen heben die Ausblendung nicht auf.
- Push-Kontexte enthalten keine ausgeblendeten Ziele. Wenn während einer laufenden Synchronisation ausgeblendet wird, folgt direkt ein neuer Kontext. Alte Push-Klicks können ausgeblendete Ziele nicht erneut auf der Karte öffnen.
- Regressionen prüfen Persistenz und Migration, strikte Karten-/Listenfilter auch bei Fokus oder aktuellem Ziel, laufende Routenberechnung, Hinweise/Push und Wiederanzeigen. Mobile Vorschau (393 × 852): Ride und Show ausblenden, nach Neustart wiederherstellen, Karte/Listen und sichtbare Touchflächen kontrolliert.

## Shows nur mit verbleibenden Spielzeiten · Build 57

- Shows/Paraden mit bekannter, für Paris datierter Spielzeit werden aus Listen, Favoritenansicht, Karte, Routenauswahl und neuen Push-Kontexten ausgeblendet, sobald heute kein zukünftiger oder noch laufender Termin mehr bleibt. Gleiches gilt für einen bestätigten leeren Tagesplan.
- Fehlende Einträge oder unlesbare Zeitangaben bleiben „unbekannt“ und werden nicht als abgesagt interpretiert. Bereits geladene Termine desselben Tages können auch nach einem Refresh-Fehler für den Tagesfilter verwendet werden. Alte Pläne verstecken am neuen Tag keine Shows.
- Der Filter wird beim Laden der Spielzeiten und alle 15 Sekunden geprüft. Veränderte Tagesverfügbarkeit aktualisiert Listen/Marker und berechnet eine aktive Route neu; Priorität/Fokus auf beendete Shows werden entfernt. Favoriten, Besucht-Status und „Nicht interessiert“ bleiben unverändert.
- Tests prüfen letzte Spielzeit/Endzeit, laufende Abendshows, fehlende/fehlerhafte/leere Quelle, Paris-Tageswechsel, automatische Wiederanzeige, Kartenfokus-Ausnahmen sowie Route und Push-Kontext. Mobile Vorschau: Animation Academy, Princess Cavalcade und Miguel ausgeblendet, Cascade of Lights weiter sichtbar.

## Shows rechtzeitig erreichen · Build 58

- Der Tagesfilter gilt in Entdecken/Top Rides/Favoriten, Karte, Route/Playlist und Navigation. Eine bekannte Vorstellung muss noch am selben Paris-Tag beginnen und ab dem aktuellen Planungs-/GPS-Start über die Parkwege erreichbar sein, inklusive drei Minuten Reserve vor Beginn. Bereits begonnene Shows sind kein neues Navigationsziel. Eine spätere Vorstellung kann das Ziel weiterhin verfügbar halten.
- Der Gehzeit-Cache wird bei geändertem Standort oder Router erneuert. Wenn eine Show nicht mehr rechtzeitig erreichbar ist, wird sie spätestens bei der nächsten 15-Sekunden-Prüfung aus aktiver Route/Markers/Listen entfernt. Bei näherem Standort oder neuen passenden Spielzeiten kann sie wieder erscheinen. Favoriten bleiben gespeichert.
- Tests decken exakte Gehzeit-Grenze, eine Millisekunde nach der Grenze, spätere Ersatzvorstellung, nicht erreichbare Wege, zeitlich unmögliche Show in Route/Listen/Karte und Wiederanzeige nach Standortwechsel ab.

## Nur bestätigte erreichbare Vorstellungen · Build 59

- Die bisherige Ausnahme für unbekannte Spielzeiten entfällt. Eine Show/Parade wird nur angezeigt, wenn eine gültige heutige Spielzeit ab dem aktuellen Start über das Wegenetz mit drei Minuten Reserve erreichbar ist. Fehlende, leere oder unlesbare Zeiten sowie ausschließlich vergangene oder morgige Termine werden ausgeblendet. Sie gelten dadurch nicht als dauerhaft abgesagt.
- Der gemeinsame Filter gilt für Entdecken, Favoriten, Karte, Route, Playlist, Navigationsziel und Push-Kontext. Am neuen Tag bleiben Shows bis zu passenden Spielzeiten ausgeblendet. Favoriten bleiben gespeichert und erscheinen automatisch wieder mit erreichbaren Terminen.
- Der Integrationstest prüft zusätzlich die tatsächlich gerenderten Route-, Playlist- und Navigationsfelder sowie fehlende Zeitdaten, nicht nur die Routenauswahl.

## Geschlossene Ziele ausblenden · Build 60

- Ein gemeinsamer Verfügbarkeitsfilter blendet geschlossene Ziele in Entdecken, Favoriten, Karte, Route, Playlist, Navigation und Push-Kontext aus. Eine geschlossene normale Schlange bedeutet ausgeblendet, außer die Single-Rider-Schlange meldet Betrieb. Eine allein geschlossene Single-Rider-Schlange blendet den normal offenen Ride nicht aus. Fehlende Wartezeitdaten werden nicht als Schließung interpretiert; ein letzter bekannter geschlossener Status bleibt bis zur Wiederöffnung ausgeblendet.
- Shows mit Status CLOSED werden auch mit zukünftigen Spielzeiten ausgeblendet. Änderungen nach einem Wartezeiten- oder Show-Update berechnen die aktive Route neu; beendete Priorität/Fokus und Check-in-Angebote für geschlossene Ziele verschwinden. Favoriten, Besucht-Status und laufende Wartezeit-Timer bleiben erhalten. Bei Wiederöffnung erscheinen Ziele automatisch wieder.
- Tests prüfen den tatsächlichen Wartezeiten-Refresh einschließlich Listen-, Karten-, Route-, Playlist-, Navigations- und Push-Ausgabe sowie normale/Single-Rider-Schließungen, Wiederöffnung und den erhaltenen Check-in-Timer.

## Fotos in Objektinfos · Build 61

- Die gemeinsame Infoansicht sowie die gespeicherten Disney-Infos zeigen kompakte offizielle Fotos für alle 92 Ziele mit eigenem Disney-Eintrag. Pro Ziel ein Bild, bei fünf Attraktionen/Shows zwei unterschiedliche Motive. Bahnhöfe ohne eigene Quelle erhalten keine erfundenen Bilder.
- Die Galerie lässt sich horizontal wischen. Antippen öffnet eine größere Ansicht mit Schließen und Bildwechsel; die Objektinfos bleiben darunter erhalten. Wartezeiten, Gehzeit und Aktionen bleiben unabhängig bedienbar. Scrollpositionen überstehen Live-Updates. Nicht verfügbare Bilder werden ausgeblendet.
- `sources/official-photo-catalogue.json` dokumentiert die gelesenen Bildquellen des offiziellen Katalogs und ausgewählter Detailseiten. `prepare-disney-photos.py` lädt kleine WebP-Dateien (800 px, insgesamt ca. 4,4 MB) und schreibt `sources/official-photos.json`. `prepare-disney-guide.py` übernimmt die lokalen Pfade in den Guide. Bilder tragen © Disney; die Originalseite bleibt in den Disney-Infos verlinkt.
- Fotos laden erst in der Objektansicht und werden nach dem ersten Ansehen offline gespeichert. Der Service Worker lädt nicht den gesamten Fotokatalog beim Start. Der PHP-Controller erlaubt ausschließlich feste WebP-Dateinamen nach der bestehenden Anmeldung; externe Disney-Seiten und Tracking-Skripte werden weiterhin nicht eingebettet.
- Prüfung: alle 30 Node-Testdateien, lokale Foto-/Quellenintegrität, Cache und Authentifizierungspfad, mobile Galerie, Vergrößern/Bildwechsel/Schließen sowie Disney-Infos bei 390 × 844.

## Shows bis 15 Minuten nach Beginn · Build 62

- Das gemeinsame Zeitfenster endet einschließlich 15 Minuten nach Showbeginn. Der frühere Drei-Minuten-Puffer vor Beginn entfällt. Die Gehzeit muss eine Ankunft innerhalb dieses Fensters erlauben. Das gilt für Listen, Favoriten, Karte, Route/Playlist, Navigation und Push-Zielkontext.
- Die Liste aktueller Shows berücksichtigt ebenfalls bereits begonnene Vorstellungen innerhalb dieses Fensters und nennt „Beginn vor … Min.“. Lange veröffentlichte Endzeiten verlängern die 15-Minuten-Grenze nicht. Eine spätere Vorstellung hält das Ziel weiterhin verfügbar; geschlossene Shows und fehlende/unpassende Tagespläne bleiben ausgeblendet. Das Zeitfenster übersteht einen Paris-Mitternachtswechsel.
- Tests prüfen exakte Grenze und eine Millisekunde danach, Gehzeit, nächste Vorstellung, laufende Shows und Cascade of Lights um 21:50 mit Ausblendung nach 22:05. Favoriten, Karte, Playlist und Push-Kontext werden gemeinsam geprüft.

## Nicht verfügbare Ziele sichtbar halten · Build 63

- Geschlossene Rides und Shows ohne bestätigte erreichbare Vorstellung bleiben auf der Karte als kleine graue Marker sichtbar. Entdecken, Favoriten und Top Rides stellen diese Ziele bei jeder Sortierung hinter alle verfügbaren Ziele und kennzeichnen den Status.
- Infos, Spielzeiten, Favoriten und Kartenfokus bleiben bedienbar. Nicht verfügbare Shows erhalten auch bei Auswahl keine große Show-Markierung. Routen, Check-in-Angebote und Push-Kandidaten verwenden weiterhin den bisherigen Verfügbarkeitsfilter; eine offene Single-Rider-Schlange hält einen Ride verfügbar.
- Wartezeiten-Updates und die bestehende 15-Sekunden-Prüfung aktualisieren Marker und Listen automatisch. Bei Wiederöffnung oder neuen erreichbaren Spielzeiten erscheinen Ziele wieder regulär. „Nicht interessiert“, Park-, Kategorie- und Besucht-Filter bleiben wirksam.
- Prüfung: alle 30 Node-Testdateien, einschließlich Verfügbarkeit/Wiederöffnung, Kartenmarker, Sortierungen, Routen- und Push-Ausschluss; Cache und App-Version auf Build 63 aktualisiert. Lokale Browserprüfung: graue 20-px-Marker, alle 12 nicht verfügbaren Ziele hinter den verfügbaren Einträgen, anklickbare Crush’s-Coaster-Infos mit deaktiviertem „Als Nächstes“.

## Wartezeit antippen: Tagesstatistik · Build 64

- Wartezeit-Badges in Navigation, Karten-Popups, Ride-Infos, Listen und Playlist öffnen eine eigene Detailansicht. Beim Schließen kehrt sie zur vorherigen Infoansicht/Playlist zurück; die Route läuft weiter.
- Tagesdiagramm in Pariser Ortszeit mit getrennten Normal-/Single-Rider-Reihen, Minimum, zeitgewichtetem Durchschnitt und Maximum. Zeitachse umfasst die heute erfassten Stunden. Schließungen und Datenlücken werden nicht als 0-Minuten-Wartezeit gezeichnet. Fehlende Tagesdaten werden ausdrücklich benannt.
- Authentifizierter Endpunkt `index.php?waitHistory=1&park=4&ride=…` liest nur öffentliche Queue-Times-Beobachtungen aus dem bestehenden privaten Cache; feste Park-Allowlist, kein Benutzer- oder Standortbezug. Laden beim Antippen, höchstens einmal pro Minute pro Ride; fehlgeschlagene Refreshes bewahren bereits geladene Werte mit „Letzter Stand“.
- Der dauerhafte Sammler läuft nun jede Minute. Quelleigene Zeitstempel bestimmen neue Daten. Gleiche Werte/Status werden als bestätigte Dauer fortgeschrieben; nur Änderungen und neue Abschnitte nach längeren Messlücken erzeugen neue Punkte. Schließung/Wiederöffnung sind eigene Zustandswechsel. Bestehende gespeicherte Daten bleiben erhalten.
- Prüfung: Node-Suite inklusive Diagramm-/Dialogregressionen; PHP prüft Paris-Tageswechsel, echte Nullwerte, Sortierung/Deduplizierung, zeitliche Abschnitte, Schließung und Wiederöffnung. Mobile Browserprüfung bei 390 × 844: Wartezeit in Ride-Infos und im Navigationsfeld antippen, Diagramm/Kennzahlen, Rückkehr zu Infos.
- `wait-history-preview.json` enthält öffentliche echte Messwerte nur für die lokale Vorschau und wird nicht deployed.

## Durchschnittlicher Tagesverlauf in 15-Minuten-Fenstern · Build 65

- Beim Antippen einer Wartezeit ist „Ø Tagesverlauf“ die Standardansicht. Für jede Viertelstunde werden alle vorhandenen Beobachtungen der letzten 30 Tage nach bestätigter Betriebsdauer gewichtet; die Anzahl tatsächlich erfasster Tage wird für Normal/Single Rider angegeben. Historische Allzeit-Durchschnittswerte werden nicht als Tageskurve verwendet.
- „Heute“ bleibt als zweite Ansicht erhalten. Fehlende Viertelstunden unterbrechen die Kurve; Schließungen tragen keinen künstlichen Nullwert bei. Kleinstes/größtes Ø beziehen sich in der historischen Ansicht auf die Viertelstundenwerte. Zeitfenster folgen der Pariser Ortszeit, auch beim Wechsel auf Winterzeit.
- Tests: historische Mittel über mehrere Tage, präzise Viertelstundengrenzen, bestätigte Dauer statt Änderungsanzahl, Schließung, reale Nullwerte, Datenlücken, 30-Tage-Grenze und DST. Alle 32 Node-Testdateien und PHP-Tests bestanden. Mobiler Browser: echte historische Kurven für Frozen Ever After, zwei erfasste Tage, Normal/Single Rider, Umschalten zu Heute und zurück geprüft.

## Durchschnitt nur im regulären Parktag · Build 66

- Historische Viertelstunden-Mittel und der heutige Tagesdurchschnitt nutzen für jeden einzelnen Tag nur bestätigte reguläre Parkzeiten: Öffnung + 15 Minuten bis Schließung − 15 Minuten. Extra Magic Time und Randzeiten zählen nicht. Fehlende Parkzeiten erzeugen keinen geratenen Durchschnitt; die tatsächliche Heute-Kurve bleibt unverändert sichtbar.
- Gewichtung: Summe aus Wartezeit × bestätigter Dauer geteilt durch die Summe der bestätigten Dauer im erlaubten Fenster. Normal und Single Rider werden getrennt berechnet. Schließungen, Beobachtungslücken und Zeiten außerhalb des Fensters bleiben ausgeschlossen; echte offene Nullwerte zählen weiter.
- `park-hours.php` liest ausschließlich OPERATING-Intervalle der festen ThemeParks.wiki-Park-IDs. Der bestehende Minutensammler prüft den privaten Kalendercache und erneuert ihn höchstens stündlich für aktuellen/vorherigen Monat. Historische Tageszeiten bleiben erhalten. Doppelte/überlappende Intervalle werden vor der Begrenzung zusammengeführt.
- Regressionen: genaue Öffnungs-/Schließgrenzen, Extra Magic Time, abweichende Tageszeiten, fehlende/fehlerhafte Stunden, Überlappungen, Viertelstunden, DST und heutiger Ø. Alle 32 Node-Testdateien und PHP-Tests bestanden. Mobile echte Daten: vor 09:45 kein heutiger Ø; historischer Ø nur aus zulässigen früheren Zeiten, Fenster 09:45–21:45 angezeigt.

## Kompaktes Objekt-Sheet auf der Karte · Build 67

- Marker öffnen direkt eine kleine Objektkarte, die von unten hereingleitet. Sie zeigt Name, Park, Gehzeit, Wartezeit/Showstatus und die Aktionen „Als Nächstes“, Favorit und „Mehr Infos“. Die Karte bleibt bedienbar; keine Abdunklung. Höhe maximal 320 px bzw. 38 % des sichtbaren Viewports, kein Foto-/Detailbereich im kompakten Einstieg. Reduzierte Bewegung deaktiviert die Animation.
- Die Zielanzeige der laufenden Route wird während der Objektkarte nur verdeckt; Route und GPS bleiben erhalten. Schließen oder ein Klick auf die Karte bringt die Zielanzeige zurück. „Mehr Infos“ und antippbare Wartezeit-Statistiken kehren beim Schließen zur kleinen, weiterhin nicht modalen Objektkarte zurück. Tabs/Parkwechsel schließen die Objektkarte. Show-/Push-Fokus öffnet ebenfalls dieses Sheet; geschlossene Ziele bleiben inspizierbar.
- Die Statistikachse umfasst das vollständige erlaubte Öffnungszeitenfenster. Später beginnende gespeicherte Beobachtungen schneiden die frühen Stunden nicht mehr von der Achse ab. Fehlende frühe Messwerte werden ausdrücklich gekennzeichnet und nicht ergänzt.
- Prüfung: alle 33 Node-Testdateien, PHP inklusive vollständiger Achse ohne erfundene frühe Werte. Mobile 390 × 844: direkter Marker-Klick, 192 px hohe nicht modale Objektkarte, große sichtbare Karte, Statistik/Details und Rückkehr. Echte historische Statistik zeigt 09:45–21:45 mit Hinweis auf erst ab 11:30 vorhandene Viertelstundenwerte.

## Vollbild-Infos und eigene Tageswartezeit · Build 68

- Objekttitel in Karte, Navigation, Check-in, Wartestatistik, Listen und Route öffnen die Objektinfos. Infos belegen den ganzen sichtbaren Bildschirm; X, Rechtswisch und Browser-Zurück kehren zur vorherigen Ansicht zurück. Check-in-Sheet, Karten-Sheet und laufende Route bleiben erhalten. Senkrechtes Scrollen schließt nicht.
- Allgemeine Info zeigt „Meine Anstehzeit pro Tag“ aus den auf diesem Gerät gespeicherten tatsächlichen Check-ins. Abgebrochene Wartezeiten werden ebenfalls gespeichert; laufende Zeit zählt live mit und wird getrennt kenntlich gemacht. Paris-Mitternacht teilt übergreifende Wartezeiten auf beide Kalendertage auf, einschließlich Sommer-/Winterzeit. Neue Aufzeichnungen werden nicht mehr nach 100 Einträgen verworfen. Bereits früher gelöschte Aufzeichnungen lassen sich nicht rekonstruieren.
- Prüfung: alle 35 Node-Testdateien bestanden. Mobile 390 × 844: Vollbild exakt 390 × 844, Navigationstitel, Check-in-Titel, X und Browser-Zurück, laufende Tageszeit und gespeicherte abgebrochene Zeit geprüft.

## Besuchte Rides bleiben sichtbar · Build 69

- Besuchte Rides bleiben als anklickbare ✓-Marker auf der Karte. Listen zeigen besuchte Ziele standardmäßig mit „besucht“; der Filter kann sie weiterhin ausdrücklich ausblenden. Favoriten bleiben erhalten, „Wieder offen“ bzw. „Als Nächstes“ ermöglichen einen erneuten Besuch. Erledigte Ziele bleiben aus der offenen Route ausgeschlossen.
- „Ride besucht“ speichert einen noch laufenden Check-in vor dessen Beendigung in der persönlichen Anstehzeit. Kein doppelter Eintrag bei „Eingestiegen“, da der Timer dort schon abgeschlossen ist.
- Prüfung: 35 Node-Testdateien; Regression für besuchte Marker und Check-in-Abschluss. Browser: Tower of Terror besucht, weiterhin auf Karte und in Favoriten mit Kennzeichnung und Wieder-offen-Aktion.

## Laufende Anstehzeit oben und Navigation beendet Check-in · Build 70

- Während eines aktiven Check-ins zeigt eine feste Bubble oben Ride und live verstrichene Anstehzeit. Ride-Titel öffnet die Vollbildinfos; der Status öffnet die Wartezeit-Anzeige. Karte, Parkauswahl und Listenkopf rücken unter die Bubble.
- Explizites neues Ziel, erfolgreich gestartete Live-Navigation, WC-Pause und Wechsel über Skip speichern den laufenden Check-in mit Abschlussgrund `navigation` und beenden Timer/Sheet/Bubble. Erneutes Anwählen desselben Rides sowie automatische Neuberechnungen/Datenupdates beenden das Anstehen nicht. Die persönliche Tagesstatistik übernimmt die gemessene Zeit einmalig.
- Prüfung: 36 Node-Testdateien. Mobile 390 × 844: Bubble bei Check-in, Karte und Parkwahl erreichbar; Skip zu Flight Force beendet den Spider-Man-Check-in und übernimmt die Zeit in die Tagesübersicht.

## Ride-Zugänge (Build 71)

`python3 prepare-entrances.py` nach Änderungen am Katalog/Wegenetz ausführen. `sources/ride-entrances.json` hält 22 geprüfte OSM-Zugangspunkte mit Begründung fest. Reguläre Anstell-Eingänge werden bevorzugt; getrennte Single-Rider-/Premier-Access-Eingänge werden nicht als reguläres Ziel verwendet. Wenn die Eingangstür im Graph fehlt oder die Warteschlange nicht eindeutig beschriftet ist, bleibt der öffentliche Zugang als ungefähr gekennzeichnet. Keine geraden Verbindungen durch Gebäude werden ergänzt. Alle Ride-Marker liegen auf ihrem tatsächlichen Routenziel im Wegenetz; die frühere Objektposition bleibt als `attractionLocation` erhalten. Nicht einzeln geprüfte Zugänge bleiben angenähert.

## Vollständige Disney-Galerien · Build 73

- `sources/official-galleries.json` dokumentiert die am 06.10.2026 im Browser geprüften 93 Disney-Seiten, 50 separate Galerien und ihre vollständige Bildreihenfolge. Die Browser-Erfassung und die gespeicherte Quellenliste wurden auf Vollständigkeit abgeglichen.
- `prepare-disney-photos.py` übernimmt sämtliche Galerie-Bilder ohne Begrenzung. Bei neueren Seiten ohne Galerie werden die eigenen Informationsbilder übernommen; allgemeine Werbebilder, Service-Piktogramme und App-Promotion werden dort aussortiert. Galeriebilder selbst bleiben vollständig erhalten.
- `prepare-disney-guide.py` und die Infoansichten begrenzen die Bilderzahl nicht mehr. Die horizontale Galerie zeigt die Anzahl; jedes Bild lässt sich vergrößern und durchblättern. Fotos werden als kompakte 800-px-WebP von Disneys Medienserver geladen; zwei animierte Galerie-GIFs bleiben im Originalformat, mit © Disney gekennzeichnet und weiterhin erst beim Ansehen zwischengespeichert.
- Prüfung: vollständige Bildreihenfolge aller Galerien gegenüber dem Quellmanifest, Dateiformat und Quellen jeder lokalen Datei, Öffnen des zehnten Alice-Bildes, korrekter Bildzähler und Navigation am Galerieende.

## Kartenfilter-Abstand · Build 74

Der ausgeblendete frühere Show-Hinweis reserviert keinen zusätzlichen Kopfabstand mehr. Der Kartenfilter bleibt beim Anstehen mit kleinem Abstand direkt unter der Bubble; die rechten Kartenwerkzeuge bleiben am oberen Kartenrand.

## Navigation zu geschlossenen Zielen · Build 75

Der Zielknopf in Karten- und Vollbildinfos bleibt auch für geschlossene Rides und Shows ohne erreichbare Vorstellung nutzbar. Die gemeinsame Zielauswahl fragt vor jeder Auswahl eines nicht verfügbaren Ziels nach Bestätigung. Abbrechen verändert weder Favoriten/Besucht-Status noch Route oder Check-in. Ein bestätigtes Ziel bleibt als manuell gesetztes nächstes Ziel bei Status-Updates und Neustart erhalten; das nächste manuell gewählte Ziel, Besucht oder Überspringen beendet diese Ausnahme. Der tatsächliche Status, graue Marker und die normale Verfügbarkeitsfilterung bleiben erhalten. Tests prüfen Bestätigung, Abbruch, laufenden Timer, echte Wegberechnung, erneute Planung, Wiederherstellen und Wechsel zu anderen Zielen.

## Besucht-Tag · Build 76

Besuchte Ziele zeigen in der Liste und den Objektinfos einen kompakten „Besucht ×“-Tag. Antippen fragt „Besucht-Tag entfernen?“ und entfernt die Besuchsmarkierung erst nach Bestätigung. Abbrechen bewahrt den Status. Nicht besuchte Favoriten behalten die Aktion zum Markieren als besucht.

## Erweiterte Show-Liste · Build 76

Die Show-Liste zeigt ohne Drei-Einträge-Limit alle bestätigten, heute noch erreichbaren Vorstellungen im gewählten Parkbereich, einschließlich späterer Zeiten und Ziele über 800 m Entfernung. Reihenfolge: Fußwegdistanz, danach Startzeit. Pro Show wird nur die nächste zu Fuß erreichbare Vorstellung angezeigt; doppelte Zeiten und Katalogeinträge erzeugen keine weiteren Zeilen. Die Liste nutzt mehr Bildschirmhöhe und bleibt scrollbar. Die kurzen Nähe-Hinweise behalten ihr bisheriges 800-m-/45-Minuten-Fenster. Tests prüfen mehr als drei Shows, Distanz-/Zeitsortierung, Mehrfachzeiten und Katalogduplikate.

## Wartezeiten, Einstellungen und Gesten · Build 77

Favoriten-Hinweise ab 20 % unter dem jeweiligen historischen Queue-Times-Durchschnitt. Eine Einstellung in Info aktiviert Single Rider für Hinweise und stellt dessen Wartezeit zuerst dar. Quellenalter, Favoriten, Entfernung und zusätzlicher Fußweg bleiben berücksichtigt. Alter/Größe des jüngsten Kindes werden optional pro Benutzer auf diesem Gerät gespeichert; die bisherigen festen Kimi-Angaben entfallen.

Shows haben die Tabs „In der Nähe“ und „Alle heute“; jede Show einmal, nach Fußwegentfernung und Startzeit sortiert. Der zweite Tab enthält auch bereits beendete bzw. geschlossene Shows mit heutigen Spielzeiten.

Gemeinsame Sheets: Griff nach oben vergrößert auf Vollbild; herunterziehen verkleinert, erneutes Herunterziehen im kleinen Sheet schließt. X schließt direkt. Info-/Foto-/Statistikseiten haben Zurück und eine rechte Wischgeste vom linken Rand. Show-Sheets bieten im Vollbild Buttons und seitliches Wischen für weitere nahe Shows. Listeneinträge nach links wischen öffnet reversible Aktionen Favorit/Ausblenden/Besucht; Entfernen des Besucht-Tags erfordert Bestätigung. Doppeltipp auf denselben Tab scrollt die Seite nach oben. Menü-Tabs haben kein X.

Benachrichtigungen werden am sicheren oberen Rand mit Abstand gestapelt. Kartenfilter rücken anhand der tatsächlichen Höhe weiter. Updatehinweise markieren Info und erscheinen dort vor den Standort-Einstellungen. Der Push-Sender meldet jeden neuen Build einmal je Subscription; Klick öffnet Info. Aktueller Client-Build wird beim Push-Sync übertragen. Release-Notizen kommen aus release-notes.json über den authentifizierten Versions-Endpunkt.

Die Statistik markiert die aktuelle Paris-Uhrzeit, aktualisiert die Linie alle 30 Sekunden und zeigt beim horizontalen Ablesen Zeit und Werte beider Warteschlangen. Lücken bleiben ohne Messwert. Für heute wird die Grafik mindestens bis zur aktuellen Stunde erweitert. Durchschnittsfenster und Gewichtung sind unverändert (regulär geöffnet +15 bis −15 Minuten).

GPS übernimmt den tatsächlichen Quellenzeitstempel, verwirft mehr als 20 Sekunden alte, rückwärts laufende, deutlich zukünftige und ungültige Messungen. Veralteter Standort wird markiert; Standortknopf fordert einen neuen Fix ohne Browser-Cache an. Keine künstliche Verschiebung auf einen Ride/Show-Punkt.

Validierung: Node-Suite einschließlich Gestenrichtungen, Nullwerte/Lücken beim Chart-Scrub, 20%-Schwelle und Single-Rider-Schalter, Profilvalidierung, Updatehinweise und GPS-Zeitstempel; mobile Browserprüfung bei 390×844 für Info, kompakt/Vollbild/kompakt und Wischaktionen.

## Benachrichtigungen und Vollbild-Sheets · Build 78

Nicht-modale Vollbild-Sheets reservieren die tatsächlich gemessene Höhe des oberen Benachrichtigungsstapels für Griff, X und Inhalt. Wenn Bubbles wachsen, hinzukommen oder verschwinden, passt sich der Abstand über den vorhandenen ResizeObserver an; ohne Hinweis entsteht kein zusätzlicher Abstand. Modale Dialoge verwenden ihre normale Kopfhöhe, da sie den Benachrichtigungsstapel ohnehin überdecken. Der Kartencontainer bekommt während eines Vollbild-Sheets eine Ebene über der Menüleiste, auch bei laufender Navigation.

Während eines laufenden Check-ins werden Navigationskarte und aktive Weglinie ausgeblendet. Die Route bleibt gespeichert; beim neuen Navigationsziel wird wie bisher die Wartezeit abgeschlossen. Der wartende Ride bleibt trotz Kartenfiltern mit einer gelben Sanduhr und einem entsprechenden zugänglichen Label markiert. Timer und Details sind über die obere Ansteh-Bubble erreichbar.

## 3D-Parkkarte · Build 79

Karteneinstellungen → 3D-Park. Echte WebGL-Perspektive mit Gebäudekörpern, verschiedenfarbigen Dächern, Bäumen und fünf selbst erstellten stilisierten Landmarken (Schloss, Big Thunder, Hyperspace, Tower of Terror, Frozen). Mit einem Finger verschieben; zwei Finger zoomen, drehen und vertikal verschieben zum Kippen. Neigung 0–70° direkt mit zwei Fingern auf der Karte; Drehbuttons und Nordausrichtung wie auf der Wegekarte. Desktop: rechte Maustaste ziehen bzw. Strg + Ziehen zum Drehen/Kippen, Mausrad zum Zoomen. Kartentyp bleibt pro Nutzer gespeichert.

Geometrie aus dem lokalen OSM-Bestand für beide Parks: 676 Gebäude, 748 Grünflächen, 60 Wasserflächen, 119 Plätze, 37 Felsflächen, 1.382 bereits verwendete Fußwegzüge und maximal 1.800 Bäume. `python3 prepare-3d.py` erzeugt `dist/park-scene.json` erneut. Gebäudegrundrisse und Innenhöfe sind geografisch; fehlende Höhen und Landmarkformen sind illustrative Annäherungen. Farbgestaltung orientiert sich am illustrierten Disney-Plan, der Plan wird nicht als verzerrte Navigationsgrundlage verwendet.

MapLibre GL JS 6.12.0 (BSD-3-Clause, offizielle npm-Distribution mit SHA-512-Abgleich) liegt in `dist/vendor/`; Lizenz dort. JavaScript-Modul und WebGL-Kamera werden erst bei Auswahl geladen. Szene, Module und Worker werden über den vorhandenen geschützten PHP-Controller ausgeliefert und im Asset-Cache aufgenommen. Es braucht keine externen 3D-Tiles oder Zugangsschlüssel. WebGL-Ausfall zeigt einen erneuten Ladeversuch bzw. die ausdrückliche Wahl der Wegekarte an und bewahrt die 3D-Präferenz.

Die 3D-Kamera synchronisiert Zentrum, Zoom und Orientierung mit Leaflet. Alle 95 Markierungen, Eingänge, Routen und GPS-Koordinaten stammen unverändert aus demselben App-Zustand. Bei aktivem Check-in wird auch in 3D nur der Ride markiert und kein Navigationsweg gezeichnet. Wechsel des Kartentyps beendet keine Route oder Warteschlange.

Prüfung: `node --test tests/*.test.cjs`, insbesondere `map-3d.test.cjs` für exakte Fußwege/Eingangsendpunkte, GPS-Radius, Innenhöfe, räumliche Meshes und MapLibre-v6-Mercatorprojektion. Browserprüfung bei 390 × 844: sichtbare Tiefengeometrie, Landmarken, Drehen, Neigung, Panning, Kartentypwechsel, Navigation und Check-in. Touchgesten und GPU-Leistung auf dem echten iPhone zusätzlich prüfen.

## Karten- und Anstehkorrekturen · Build 80

Alle 95 Ziele sind im Standortprüfprotokoll `sources/location-audit.json` dokumentiert. Vergleichsgrundlagen: offizieller Disneyland-Attraktionsplan ab März 2026 (https://brochure.disneylandparis.com/HCP/EN/adlp/common/data/catalogue.pdf), offizielle Disney-Adventure-World-Karte (https://disneyparksblog.com/dlp/guide-to-disney-adventure-world/), offizieller Disney-Verzeichniskatalog und lokale OSM-Spielorte. 15 Punkte korrigiert: insbesondere A Celebration in Arendelle vom Parkeingang um rund 760 m an die Arendelle-Bucht, Minnie an Studio D, TOGETHER an die kartierte Haupttür des Studio Theater und Royal Castle Stage an den eigenen Spielort. Die 22 bereits geprüften Warteschlangenzugänge bleiben erhalten. Die übrigen Zugänge sind je nach Quelle als kartierter Zugang, Annäherung oder variabler Treffbereich gekennzeichnet. Disney-Zeichnungen sind nicht maßstäblich; daher werden daraus keine ungenauen GPS-Koordinaten durch einfache Bildtransformation errechnet.

`python3 review-locations.py` prüft Identitäten, behält Ride-IDs, dokumentiert jeden Standort, wendet eindeutige Spielortkorrekturen an und erzeugt `dist/ride-summary.json`. Nach Daten-Neugenerierung nach `prepare-entrances.py` ausführen. `python3 prepare-3d.py` aktualisiert anschließend die 3D-Szene. `ride-summary.json` enthält nur die für die Push-Validierung nötigen 95 Katalogeinträge, damit PHP nicht das große Wegenetz mit 128 MB Speicherlimit dekodieren muss.

Alle Shows und Figurenevents haben Indoor-/Outdoor-Metadaten aus dem offiziellen Katalog bzw. nachgewiesenen Innen-Spielorten. Indoor-Shows erfordern Ankunft 15 Minuten vor Beginn; für Empfehlungen, aktuelle Erreichbarkeit und Push gilt Start minus 15 Minuten minus Fußweg. Spielzeiten zeigen den spätesten Ankunftszeitpunkt. Outdoor behält die bestehende Karenz. Einlassbedingungen und tatsächliche Platzvergabe bleiben beim Park.

Ein Sheet für den laufenden Check-in ist gelb und ersetzt den Fußweg durch die sekundengenaue Ansteh-/Restzeit. Es zeigt Eingestiegen und Abbrechen statt Aktuelles Ziel. Andere Objekte bleiben normal. Der Sekunden-Tick aktualisiert nur die Zeit, ohne Fotos oder den scrollbaren Inhalt neu aufzubauen. Schließen beendet den Timer nicht. Ein Touch-/Öffnungsfokus erzeugt keinen blauen Rahmen; explizite Tastaturnavigation per Tab behält sichtbaren Fokus.

3D bleibt bei Navigation, Auf Karte zeigen, GPS-Folgen und nach Neuladen ausgewählt. Ladefehler ändern die gespeicherte Wahl nicht und überschreiben keine spätere ausdrückliche Wahl. Ein Worker und deaktiviertes Multisample-Antialiasing reduzieren die GPU-/Speicherlast auf Mobilgeräten. Die Karte nutzt native MapLibre-Gesten zum gemeinsamen vertikalen Ziehen mit zwei Fingern; der Neigungsregler ist entfernt. Die weletapi-Sicherheitsrichtlinie bleibt unverändert.

## Liste und feste Oberflächengröße · Build 81

- Swipe-Einträge verschieben ihren gesamten Inhalt einschließlich Favoriten-Knopf als eine deckende Fläche. Die Aktionen sind bis 36 Pixel nach links unsichtbar und inert; danach bleiben sie auf den tatsächlich freigelegten rechten Rand begrenzt. Vertikales Scrollen, Zurückwischen und die bisherigen umkehrbaren Aktionen bleiben erhalten.
- Die Kataloge Entdecken/Favoriten/Beste Rides stellen erreichbare Shows ohne laufende oder in maximal 30 Minuten beginnende Vorstellung hinter die aktuell nützlichen Ziele. Innerhalb jeder Gruppe bleibt die gewählte Sortierung nach Entfernung, Name oder Bewertung erhalten. Geschlossene Ziele bleiben zuletzt; die Tagesverfügbarkeit und Navigation späterer Shows werden nicht eingeschränkt.
- Viewport, Touch-Action und Safari-Gestenbehandlung halten die Oberfläche auf ihrer normalen Größe. Mehrfinger-Gesten werden ausschließlich auf den drei Kartenflächen zugelassen; Zoomen, Drehen und Neigen der Karten bleiben möglich. Eingaben auf Touch-Geräten haben mindestens 16 Pixel, um automatischen Fokus-Zoom zu verhindern.
- Sheet- und Navigationsgrößen folgen dem Finger kontinuierlich über die gesamte Bewegung. Beim Loslassen gleiten sie in 220 ms zur gewählten Ansicht. Abgebrochene Gesten stellen die Ausgangsansicht wieder her; die Bedienflächen bleiben relativ am Sheet befestigt.

## Stabiler mobiler 3D-Renderer und Navigation · Build 82

- Die alte WebGL-Kontextverlust-Behandlung entfernte die Karte dauerhaft. Der neue Lebenszyklus registriert den Verlust schon vor dem ersten Frame und erstellt automatisch höchstens zwei neue Renderer mit kleinerem Budget. Kamera, Route, Zielmarkierungen und Kartenwahl bleiben erhalten. Initiale Szenendaten werden wiederverwendet, alte Ereignisse ignoriert und Ladeversuche begrenzt. Ein expliziter Wechsel zur Wegekarte stoppt die Wiederherstellung. Auf Hardware, die WebGL wiederholt verweigert, bleibt ein ehrlicher Fehler mit manuellem Retry.
- Pixeldichte maximal 1,5 (bei Wiederherstellung 1), mobiler Wald 600 statt 1800 Bäume (bei Wiederherstellung 180), kein zusätzliches Dach-Extrusionsmesh auf Touch-Geräten und kleinere Tile-Caches. Alle eigentlichen Gebäude, Gewässer und Fußwege bleiben erhalten. Mehrere Blur-Flächen über der 3D-Karte werden vermieden. GLSL-/Dekorationsfehler betreffen nur die optionale Landmarken-Schicht, deren VAO/Buffer/Program-Zustand jetzt ordnungsgemäß wiederhergestellt wird.
- Die Liste zeigt die nächste veröffentlichte heutige Vorstellung in Pariser Ortszeit samt Minuten-Countdown und Indoor-Frist. Aktuell laufende letzte Shows bleiben kenntlich; ungültige oder fremde Tage erzeugen keine erfundenen Termine.
- `prepare-facilities.py` erzeugt 26 Trinkwasserstellen und 46 Restaurants/Cafés aus den OSM-Tags innerhalb der vollständigen Grenzpolygone 775180147 und 205734843. Keine Zierbrunnen als Trinkwasser, keine Privat-Zugänge und keine erfundenen Verbindungswege. Ziele liegen auf bestehenden erreichbaren öffentlichen Graphpunkten, unbestätigte Zugänge sind ausdrücklich ungefähr. Suche über Navigation → Mehr; ein Pausenstopp erhält den bisherigen nächsten Ride. Beim Navigationswechsel wird eine laufende Anstehzeit wie bisher beendet und gespeichert.
- Das große Ride-Sheet aktualisiert Spielzeiten, Zusatzinfos und Galerie separat. GPS-Updates ersetzen unveränderte Foto-Elemente nicht; auch eine geänderte Showzeit lädt die Galerie nicht neu. Ein Check-in ist unmittelbar auf der kleinen und großen Ride-Karte möglich.

Renderer-Referenzen: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#pixelratio und https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/; installierter MapLibre-Code wurde zusätzlich auf den tatsächlichen Kontextverlust- und WebGL2-Lebenszyklus geprüft. Der Screenshot allein beweist keine bestimmte iPhone-GPU-Ursache.

Build 82: Sprachfelder `language`, `languages` und ältere sprachbezogene `type`-Werte bleiben im authentifizierten Show-Proxy erhalten. Bekannte Sprachen stehen neben der Startzeit in Listen, Spielzeiten, Karten-Sheets und Hinweisen; gleichzeitige Sprachen werden zusammengeführt. Die am 06.10.2026 geprüfte Livequelle enthält nur `Performance Time` und keine Sprachzuordnung pro Vorstellung. Fehlende Sprachen werden nicht aus der Reihenfolge geraten. Normale Listentaps verändern das DOM erst bei einer tatsächlichen horizontalen Bewegung; dadurch bleiben Titel und Buttons schon beim ersten Tippen erreichbar.

## Build 83 – Indoor-Ankunft zehn Minuten vorher

Der Indoor-Vorlauf beträgt jetzt 10 statt 15 Minuten. Listen, Spielzeiten, Karten-Sheet, Erreichbarkeit, Empfehlungen und serverseitige Push-Hinweise verwenden die neue Frist. Gehzeit kommt weiterhin zusätzlich dazu. Outdoor-Karenz und die 15-Minuten-Fenster der Wartezeitstatistik bleiben unverändert. Grenztests prüfen rechtzeitige Ankunft und Ablehnung eine Millisekunde nach der letzten möglichen Abmarschzeit.

## Build 84 – 3D-Diagnose und kompakte Karteneinstellungen

`map-diagnostics.js` sammelt maximal 32 technische Ereignisse: Bibliothek/Szene geladen, Kartenaufbau, erster Frame, Quellen bereit, Kamerabewegungen beim Laden, Load-Abschluss, Shader-/Renderfehler und WebGL-Kontextverlust. Frame-/Bewegungszähler und Zeit bis zum Fehler unterscheiden bereits sichtbare Geometrie von einem ausbleibenden Load-Ereignis. Rohdaten zu Standort, Route, Rides, Accounts, vollständigem User-Agent, URLs und Stacktraces werden nicht versendet. Fehlertexte werden im Client und auf dem Server gekürzt und von URLs, Koordinatenpaaren, E-Mail-Adressen und langen Hex-Tokens bereinigt. Browser/OS-Version, Bildschirm-/Rendergröße und standardisierte WebGL-Grenzen werden mitgesendet. Das exakte iPhone-Modell ist in Safari nicht verfügbar und kann einmal unter Info eingetragen werden; Android-Modell/Client-Hints werden übernommen, sofern vorhanden.

Fehler werden automatisch mit 700 ms Bündelung und maximal zehn erfolgreichen Berichten pro App-Lauf an `index.php?diagnostics=1` gesendet. Offlineberichte bleiben lokal, ohne Nutzerdaten; nächster Start oder Online-Wechsel versucht erneut. Ein technischer Checkpoint nach einem ohne pagehide unterbrochenen Lauf heißt ausdrücklich `previous-interrupted` und beweist allein keinen GPU-Absturz. Unter Info kann ein Bericht manuell gesendet werden, die erfolgreiche Serverantwort liefert eine zwölfstellige Bericht-ID.

Der Endpunkt verwendet den vorhandenen aktiven Login, Origin-Prüfung und Session-CSRF. Serverseitige Feld-Allowlist, 16 KiB Eingabelimit und 20 Berichte je Account/Stunde. Ablage ausschließlich `/var/lib/weletapi-disney-diagnostics/report-<id>.json`, außerhalb des Webroots, Verzeichnis 0700 und Dateien 0600. Accountnamen stehen nicht in den Berichten; Ratenbegrenzung benutzt getrennte gehashte Dateinamen. Berichte werden nach sieben Tagen bereinigt, zusätzlich maximal 1.000 Dateien. Keine neue Freigabe oder öffentlich lesbare Log-URL. Analyse per SSH anhand der angezeigten ID.

Kartentyp-Auswahl verwendet eine eigene CSS-Klasse ohne die für Karten-Overlays vorgesehene Breitenbegrenzung. Manuelle Ausrichtungsregler aus dem Einstellungs-Sheet entfernt. 3D-Fehlermeldung zeigt nur Titel und zwei nebeneinanderliegende Aktionen; Diagnosestatus bleibt im Info-Tab.

## Build 85 – tatsächlicher Live-GPS-Abbruch behoben

Die Diagnoseberichte 6f5da0918b69/71c2e8a9ee5e vom 06.10.2026 zeigen abgeschlossene Scene-/Map-/Mesh-Initialisierung und anschließend `TypeError: undefined is not an object (evaluating 'e.lng')`, ohne WebGL-Kontextverlust. Der blaue Standortmarker wurde mit `Marker.addTo` angehängt, bevor `setLngLat` aufgerufen wurde. MapLibre projiziert den Marker sofort beim Anhängen und erhält dabei undefined. Die Koordinaten werden jetzt vor addTo gesetzt. Regression prüft den Kartenstart mit synthetischem aktivem GPS und verweigert grundsätzlich Marker ohne vorher gesetzte Koordinaten. Kamerabewegungen und Graphdaten sind unverändert.

## Build 86 · Altersgruppen und 3D-Orientierung

Der offizielle Disney-Katalog wurde am 06.10.2026 mit allen sieben Altersfiltern gelesen. `sources/official-ages.json` hält die sichtbaren Ergebnisse fest. Exakt gleiche offizielle Titel verbinden Disney-URL-Aliase wie `its-a-small-world-app`; Altersangaben werden nicht aus Größe/Intensität geschätzt. Shows verwenden die bereits erfassten Disney-Kataloggruppen. Die drei weiteren Railroad-Bahnhöfe übernehmen ausdrücklich die offizielle Angabe zum selben Railroad-Erlebnis.

Ride-/Show-Listen, Karten-Sheets und Infos zeigen die Disney-Altersgruppen. Zusätzliche Kindertipps aus Sortiraparis (24.09.2026) stehen getrennt mit Quellenlink; sie sind keine Zugangsbeschränkung und kein Höchstalter. Der Altersgruppenfilter in Entdecken/Favoriten/Top Rides berücksichtigt `All Ages` für jede einzelne Gruppe; Filter werden je Tab gemerkt und beim Zurücksetzen gelöscht.

3D verwendet stärkere Land-Farben, kontrastierte Wege und Wasser. WC und Trinkwasser bleiben auf beiden Karten sichtbar. Gebäudeschilder sind eigenständige Markierungen über nachgewiesenen Gebäudegrundflächen; Höfe und reine Außenstandorte bekommen keine erfundenen Dächer. Vorhandene offizielle Logo-Bilder werden verwendet, ansonsten ein Namensschild. Deren Bild-/Namensposition ändert niemals den Navigationseingang. Dachhöhen sind weiterhin illustrativ; die Höhenverschiebung des Schilds ist eine Bildschirmprojektion. Schilder werden nach Zoom/Viewport/Kollision begrenzt und verwenden bereits vorhandene lokale Fotos.

Die oberen Bedienelemente und Listen-Seiten verwenden keinen Hintergrund-Blur mehr. Build 85s GPS-Marker-Korrektur bleibt enthalten.

## Build 87 · Fotografierte Dachflächen

Apple Maps/MapKit JS wurde anhand der offiziellen API-Dokumentation geprüft. Es gibt dort keinen Export der fotorealistischen Flyover-Gebäude für unseren MapLibre-Renderer. Die Umsetzung nutzt deshalb ausschließlich IGN BD ORTHO unter Licence Ouverte Etalab 2.0, keine Apple-Karteninhalte. `sources/ign-ortho.json` hält GetMap-Anfrage, EPSG:3857-Georeferenz, Quellen-/Lizenzlinks und Aufnahmedatum fest. Die IGN-Datumsübersicht vom 21.09.2026 nennt für Seine-et-Marne die Aufnahme 2024.

Ein uneditiertes WMS-JPEG (2048×2048, 794450 Bytes) wird auf 655 bestehende Gebäudegrundflächen gelegt. `prepare-photo-roofs.py` trianguliert mit Shapely 2.1 die Dachpolygone einschließlich Löchern. Der südliche Ausbau von 2026 bekommt keine Textur der damaligen Baustelle. Die geografischen Dach-UVs beziehen sich auf Web-Mercator; die 3D-Höhen bleiben die vorhandenen teils illustrativen Werte. Fassaden werden weiterhin modelliert. Das ist eine Verbesserung der Dachdarstellung, keine fotogrammetrische Fassaden- oder Flyover-Rekonstruktion.

Die optionale Custom-Layer lädt nach Kartenstart eine einzige lokale Textur (16 MiB auf der GPU) und einen ca. 464-KiB-Vertexbuffer. Sie stellt Textureinheit/Bindungen, VAO/Programm, Flip-Zustand und Renderzustände wieder her und gibt sämtliche GPU-Ressourcen beim Schließen bzw. Kontextverlust frei. Fehler lassen die Karte weiterhin funktionieren und werden als `roof-texture-error` über die bestehende private Diagnose gemeldet. Nach Grafik-Wiederherstellung wird die Fotolayer nicht neu angelegt. Navigationsgraph, Eingangspositionen, Gebäudeumrisse und heutige Parkwege bleiben unverändert.

Die lokale JPEG-Datei nutzt dieselbe authentifizierte Asset-Auslieferung und denselben Service-Worker-Cache wie die übrige App; es werden keine Standorte an IGN gesendet. Attribution: Kartenfuß `Dächer © IGN 2024`. `prepare-3d.py` wendet nach der Geometrie-Erzeugung die Dachprojektion erneut an, wenn das Bild/Quellenmanifest vorhanden sind. Dafür die vorhandene Plaza-Umgebung oder eine Umgebung mit `requirements-3d.txt` verwenden.

Prüfung: 57 Node-Tests inklusive Dachgeometrie/Innenhöfe/UVs, GL-Zuständen, Fehlerfall und Ressourcenfreigabe; Produktions-CSP im Browser mit aktivem synthetischem GPS sowie kompletter mobiler App.

## Build 88 · Geformte Gebäude und Fassadenschilder

Die Dachfotografie aus Build 87 ist auf Wunsch entfernt: keine Fotolayer, keine IGN-Textur im Service-Worker oder in der Asset-Freigabe. Ride-Infogalerien bleiben erhalten. `prepare-building-shapes.py` erzeugt farbige Dachmeshes auf den OSM-Grundflächen mit Innenhöfen. Veröffentlichte `roof:shape`-Tags werden übernommen; fehlende Dachformen/Höhen sind ausdrücklich illustrative Näherungen. Kleine Gebäude in Main Street/Fantasyland/Frontierland erhalten passende Satteldächer. Ein gemeinsamer Mesh enthält Dächer und Landmarken.

Schloss, Tower-Hotel, Space Mountain und Elsas Schloss verwenden eigene stilisierte Formen mit Dachaufbauten, Türmen und Kuppeln. Anker und Abmessungen kommen aus den jeweiligen OSM-Umrissen. Die 59 Meter des Towers betreffen nur den hohen Hotelteil; der Sockel über dem gesamten Grundriss ist 12 Meter. Space Mountains Kuppel sitzt auf der tatsächlichen runden Gebäudefläche. Elsas Schloss wird A Celebration in Arendelle zugeordnet, nicht dem Frozen-Warehouse. Die Modelle sind keine genaue Architekturaufnahme. Navigationseingänge und Wege werden nicht verändert.

36 beschriftete Fassadenschilder stehen als vertikale 3D-Flächen auf nachgewiesenen Gebäudeaußenwänden bzw. den Modellfronten. Ein Canvas-Atlas (1024×864, ungefähr 3,4 MiB RGBA) vermeidet Einzeltexturen und Netzwerkabrufe. Auf den Dächern stehen eigene SVG-Namenslogos; es werden keine Galerie-Fotos als Logos verwendet. Bekannte Beschriftungen wie THE HOLLYWOOD TOWER HOTEL und SPACE MOUNTAIN werden nachgebildet; Schrift/Logo-Gestaltung ist keine originalgetreue Disney-Grafik.

Die Schilderlayer stellt gemeinsam genutzte WebGL-Zustände wieder her und gibt Textur, Buffer, VAO und Programm beim Entfernen frei. Fehler betreffen nur die optionale Beschriftung und werden ohne Standortdaten als signs-error im bestehenden privaten Diagnosekanal gemeldet. Regressionen prüfen Modellanker, Tower-Höhe, vertikale Schildergeometrie, Text-Escaping, GPU-Ressourcen und die Entfernung der Fotolayer.

## Build 89 · Jüngstes Kind im Onboarding

Nach App-Installation bzw. Browser-Fortsetzung fragt ein eigener Schritt nach Alter (0–17 Jahre) und Größe (40–220 cm) des jüngsten Kindes. In der installierten App erscheint er direkt vor Standort/Push. Vorhandene Kinderangaben werden vorausgefüllt. „Ohne Kinder weiter“ entfernt die Kinderkonfiguration und erhält andere Einstellungen. Standort-/Push-Freigaben können die Familienfrage nicht automatisch überspringen.

Onboarding und Info-Einstellungen verwenden dieselbe Eingabevalidierung und denselben lokalen Preferences-Eintrag. Leere Werte werden nicht als null Jahre/Größe interpretiert; ungültige Eingaben und Speicherfehler lassen den Schritt offen. Kinderdaten werden nicht an den Push-Server gesendet. Bestehende Nutzer mit abgeschlossenem Onboarding werden nicht erneut durch die Einrichtung geführt.

## Build 90 · Parknähe, gemalte Dachschrift und Einrichtungslayer

Über 10.000 Meter Luftlinie vom gemeinsamen Parkeingang (48.87050, 2.77972) sperrt der erkannte GPS-Standort die Routenberechnung, Navigation, Als-Nächstes-Aktionen, Einrichtungen-Pausen und neue Check-ins. Favoriten und Infos bleiben verfügbar. Genau 10 km ist zulässig; die bestehenden Anforderungen an Live-Navigation (frischer genauer Standort im Wegenetz) gelten weiterhin. Manueller Planungsstart verändert den tatsächlichen Abstand nicht. Ein ausschließlich lokales Ja/Nein-Feld merkt die zuletzt erkannte Distanzsperre über Neustarts; neuer GPS-Fix in Parknähe hebt sie auf. Unbekannter Standort wird nicht als weit entfernt erfunden. Laufende Worker werden beim Verlassen ungültig, Favoriten/Anstehzeit erhalten.

Bei Entfernungssperre verschwinden Fußwegwerte und die Sortieroption Nächste zuerst. Entfernung wird vorübergehend durch Name A–Z ersetzt, mit weiterhin geschlossenen/späteren Shows am Ende. Die frühere Wahl kehrt in Parknähe zurück; ausdrückliche Bewertungs-/Namenswahl bleibt erhalten.

`prepare-roof-lettering.py` erzeugt 125 Textflächen aus benannten OSM-Gebäuden bzw. darin liegenden Katalogzielen. Keine erfundenen Namen für unbekannte Dächer. Schrift wird an den echten Dachdreiecken geschnitten, einschließlich Hoflöchern; Höhen und Neigungen stammen direkt aus den stilisierten Dach-/Landmarkenmeshes. Keine HTML-Schilder oder Höhenprojektion für Dachnamen. Ein transparenter Canvas-Atlas (2048×1536; ungefähr 12 MiB RGBA) und 4857 Textvertices werden einmal erzeugt; MapLibre-Gl-Zustände/Ressourcen werden wiederhergestellt/freigegeben. Optionaler lettering-Fehler lässt die Karte benutzbar und geht ohne Namens-/Standortdaten in die bestehende Diagnose. Fassadenschilder bleiben vertikale Geometrie.

WC, Trinkwasser und Restaurants sind in Wegekarte und 3D standardmäßig aus. Drei unabhängige Schalter werden je lokalem Account gespeichert. Ein bewusst gewählter oder aktiver Navigationsstopp bleibt sichtbar, auch bei ausgeschalteter Gruppe. Beide Renderer teilen dieselben gefilterten Punkte. Gedruckte Symbole im Disney-Originalplan sind Teil des Bildes.

`restaurant-ratings.js` enthält 11 zugeordneten Restaurants mit belegten Tripadvisor-Snapshots, Wert, Anzahl, Quellenlink und Abrufdatum 06.10.2026. Suchmaschinenkopien der Quellseiten können älter sein; es handelt sich nicht um Livewerte. 35 weitere Restaurant-/Kiosk-Ziele bleiben ohne erfundene Bewertung. Sterne auf beiden Karten, Bewertungen in Details und Einrichtungssuche. Quellenmanifest: `sources/restaurant-ratings.json`.

### Restaurantsuche und kleine Wege in beiden Parks (Build 91)
- Entdecken/Favoriten: Restaurants ausschließlich bei explizitem Typ-Filter „Restaurants“, niemals unter „Alles“ oder allein durch einen Suchbegriff. Sucht Name, Typ, Park und erfasste Küche, mit deutschen Küchenbezeichnungen, mehreren Suchwörtern und Akzenttoleranz. Restaurant/Café/Imbiss und Küche erscheinen in Liste, Karte und Detailinfos. Fehlende Küchen werden nicht erfunden. Ride-Alters-/Favoriten-/Besucht-Filter sind in diesem Modus verborgen und bleiben für die Rückkehr erhalten. Restaurantnavigation verwendet die bestehende Pausenlogik und 10-km-Grenze.
- `restaurant-search.js` enthält die gemeinsame Suche für das Verzeichnis und Navigation → Mehr → Restaurants; im PHP-Assetverzeichnis und Service-Worker enthalten.
- Gesamtes erfasstes OSM-Wegenetz innerhalb beider Parkgrenzen abgeglichen: acht fehlende verbundene öffentliche Durchgänge/Treppen ergänzt, darunter Fort Comstock und Main-Street-Arcaden. 391 bereits vorhandene Wege mit Zwischenpunkten bis 5 m verdichtet, damit GPS auch zwischen den früheren Endpunkten am richtigen kleinen Weg einsteigt. 1.735 zusätzliche Punkte und 5.620 gerichtete Kanten; der dichte Platzgraph wird nicht verdichtet.
- Reproduzierbar mit `python3 prepare-small-paths.py` nach `prepare-plazas.py`; bestehende Zielindizes bleiben stabil. Verbindungen nur entlang tatsächlich erfasster Geometrie und gemeinsamer Quellpunkte, keine erfundenen Verbindungen über Mauern/Grünflächen. Nicht angebundene Wege, private/zugangsbeschränkte Wege und zusätzliche Warteschlangen werden ausgeschlossen. Bestehende gerichtete Wege bleiben erhalten. 2D- und 3D-Ansicht teilen dieselbe ergänzte Weggeometrie.
- 61 Node-Testdateien bestanden, einschließlich öffentlicher Hin-/Rückwege, punktgenauer kleiner Segmente, Eingangsindex-Erhalt, Wiederholbarkeit, Suchfilter und Navigation. Mobile Browserprüfung: deutsche Küchensuche, expliziter Filter, normale Suche ohne Restauranttreffer und Navigation aus dem Suchergebnis. Echte GPS-Genauigkeit und aktuelle Sperrungen müssen vor Ort geprüft werden.

### Suchfeld, Tab-Tippen und Karten-Pins (Build 92)
- X rechts im Suchfeld (auch Navigation → Mehr → Ortssuche) leert den Text, aktualisiert die Treffer und behält Filter und Eingabefokus. Bei leerem Text verborgen; native WebKit-Cancel-Fläche wird ausgeblendet, damit nur ein X erscheint.
- Ein einzelnes Tippen auf den bereits ausgewählten Menü-Tab scrollt die aktuelle Seite sanft nach oben. Top Rides gehört dabei zum Entdecken-Tab und bleibt erhalten. Andere Tabs stellen weiterhin ihre frühere Suche, Filter und Scrollposition wieder her; reduzierte Bewegung wird respektiert.
- Jeder Treffer im Verzeichnis besitzt einen Karten-Pin, einschließlich geschlossener Ziele und Restaurants. Der Pin zoomt auf das Ziel und öffnet das bestehende Karten-Sheet. Erst dessen Navigationsaktion verändert die Route. Restaurants haben damit denselben Ablauf; der Pin bleibt auch außerhalb der 10-km-Grenze nutzbar, die Navigation bleibt dort gesperrt. Ortssuche besitzt ebenfalls Pins; modale Suche schließt vor der Kartenansicht.
- Alle 61 Node-Testdateien bestanden; nach der abschließenden Beschriftung wurden die betroffenen drei Tests erneut erfolgreich ausgeführt. Mobil geprüft: X leert und liefert 95 Treffer, Retap scrollt von 1748 px auf 0, Pin für Ride/Restaurant öffnet Karte und Sheet, Navigation zu Stark Factory startet erst über den Karten-Button. Screenshot `Disney-Suche-Pin-Build92.png` im Aufgabenordner.

### Vier Sheet-Stufen und direkte Geste (Build 93)
- Gemeinsame Detents `minimum`, `normal`, `large`, `fullscreen` für Navigation und alle Dialog-Sheets. Normale Seiten behalten Zurück-Geste und Vollbild. Minimum zeigt den Titel (Navigation auch Entfernung und Skip), normal die Hauptaktionen, größer bei Kartenobjekten auch Galerie/Zeiten/Infos, Vollbild den gesamten Bereich. Weiteres Herunterziehen aus Minimum schließt Dialoge, beendet jedoch keine Navigation.
- Der Anfasser beansprucht den ersten Pointer unmittelbar mit `preventDefault` und Pointer-Capture, enthält einen größeren Fingerbereich und verarbeitet Touch/Maus gleich. Klick nach einem Drag verändert die Größe nicht; ein echter neuer Tap ist wieder gültig. Abbruch/Capture-Verlust stellt die ursprüngliche Größe wieder her.
- Die Bewegung interpoliert live durch alle vier Rahmen. Vor dem nächsten Drag wird die vorherige Animation beendet und erst danach die aktuelle Geometrie gelesen; nach Loslassen wird in den nächsten bzw. nächstgelegenen Detent eingerastet. Große Züge können mehrere Stufen durchlaufen. Tap/Keyboard-Klick auf den Anfasser wechselt eine Stufe mit zugänglicher Größenbeschriftung.
- Tests umfassen erstes Hochziehen, vier Größen in beide Richtungen, unterbrochene und rasch aufeinanderfolgende Gesten, laufende Geometrie, Klick-Unterdrückung und Mindestgrößen-Dismissal. Mobile Vorschau unter Produktions-CSP geprüft.
- Anfasser und X bleiben beim Scrollen im kleineren/größeren Sheet sichtbar; die gelbe Anstehfarbe bleibt erhalten. Alle 61 Testdateien bestanden, nach den letzten CSS-Anpassungen betroffene Gesten-/Karten-Sheet-Tests erneut erfolgreich.
- Ein noch laufender Öffnungsversatz wird vor der ersten Geometriemessung beendet. Regressionstest beginnt ausdrücklich mit einem solchen Versatz und prüft direktes Hochziehen ohne vorherige Gegengeste.

### Acht Sprachen (Build 94)

- Deutsch, Französisch, Italienisch, Spanisch, Chinesisch (vereinfacht), Japanisch, Koreanisch und Arabisch. Auswahl im Onboarding und unter Info → Sprache; unterstützte Gerätesprache als Vorgabe. Die Gerätepräferenz bleibt lokal gespeichert. Arabisch verwendet RTL einschließlich Zurück-Geste; Kartenachsen, Kompass und Statistik-Zeitachsen behalten ihre geografische bzw. chronologische Richtung.
- 755 semantisch formulierte UI-Meldungen einschließlich Anstehzeit, Showzeiten, Altersgruppen, Zugangshinweisen, Suche, Statistik, Bestätigungen, Installation und Offline-Hinweisen. Keine Übersetzungsdienste oder zusätzlichen Datenübertragungen. Sprachwechsel verändert weder Favoriten/Kinderdaten noch aktive Anstehzeit, Route oder Sheet-Stufe. Restaurant-Küche und Sprache werden getrennt übersetzt; Suche berücksichtigt alle Sprachen.
- Namensnachweise: offizielle Disney-Kataloge vom 06.10.2026 unter `sources/official-names-*.json`, 92 zugeordnete Attraktionen und Unterhaltungsangebote je Deutsch/Französisch/Italienisch/Spanisch. Drei zusätzliche Bahnhofshalte besitzen keine eigene Disney-Seite. Für die vier übrigen Sprachen nennt Disneys Marktauswahl keine entsprechende Paris-Website: internationale offizielle Namen bleiben erhalten. Detail-Links folgen der verfügbaren Disney-Länderseite; die Namen bleiben mehrsprachig suchbar. Dachschriften behalten die realen Gebäudenamen.
- `localization/messages*.tsv` enthält Ausgangstext und sieben vollständige Übersetzungen; `python3 prepare-i18n.py` prüft eindeutige Quellen und identische Platzhalter und erstellt die Laufzeitkataloge sowie Installationsmanifeste. DOM-Texte werden synchron lokalisiert; IDs, Attribute für Aktionen und Suchtexte bleiben unverändert. Galerieelemente werden bei laufenden Aktualisierungen nicht wegen Übersetzung ersetzt.
- Push-API speichert ausschließlich den geprüften Sprachcode zusätzlich zu ihrem bisherigen Kontext. Browser und Push-Server verwenden denselben Katalog. Bestehende 10-Minuten-Einlassfristen, Relevanz, Deduplizierung und Datenschutz bleiben erhalten. SW speichert nur den Sprachcode für Offline-Hinweise; Authentifizierung und CSP unverändert.
- 63 Node-Testdateien bestanden, einschließlich neuer Sprach-/Benachrichtigungstests. Betroffene Karten-/Dialogtests nach abschließenden Anpassungen erneut bestanden. Mobil geprüft: alle acht Sprachwechsel, RTL ohne Überbreite, Suche nach englischen Namen mit französischen Treffern, chinesische Restaurantsuche „意式“, laufende Anstehzeit beim Wechsel Chinesisch → Japanisch und gespeicherte Sprache nach Neuladen. Keine Browser-JavaScript-Fehler.
- Live auf weletapi veröffentlicht; 24 App-Dateien und drei Push-Module per SHA-256 geprüft. PHP-Syntax und alle vier PHP-Testdateien bestanden. Backup: `/var/backups/weletapi-disney/build94-20261006-200613`. Unangemeldete Live-Anfragen bleiben geschützt. Screenshots: `Disney-Mehrsprachig-Build94.png` und `Disney-Arabisch-Build94.png` im Aufgabenordner.

### Einheitliche Containerabstände (Build 95)

- Gemeinsamer Abstand `--container-gap:18px` für die Info-Seite, Einstellungen und Onboarding-Abschnitte. `section-stack` und die Info-Panel-Struktur verwenden Flex-Gaps; direkte Kinder addieren keine eigenen vertikalen Margins mehr. Dadurch haben Sprachauswahl, Standort-Karte, Diagnose, Park-Infos, Tagesstatistik und Einstellungen denselben Abstand.
- Überschrift und Status „Im Park“ sind ein zusammengehöriger Abschnitt. Abstände innerhalb von Karten und zwischen nebeneinanderstehenden Buttons bleiben eigene Layoutwerte.
- Mobile Browserprüfung (402 × 874 px): acht innere und vier äußere Abschnittsabstände jeweils exakt 18 px, auch mit arabischem RTL. Keine Überbreite und keine JavaScript-Fehler. Bestehende Update-, Offline-Cache-, Sprach-, Notification- und mobile Seiten-Tests bestanden. Screenshot `Disney-Containerabstand-Build95.png` im Aufgabenordner.
- Update-Hinweis in allen acht Sprachen; App, HTML und Service-Worker auf Build 95.
- Auf weletapi veröffentlicht, sechs Live-Dateien per SHA-256 verifiziert, PHP-Syntax und übersetzte Release-Notiz geprüft; Zugriff bleibt anmeldungsgebunden. Backup: `/var/backups/weletapi-disney/build95-20261006-205745`.

### Schloss und Drache (Build 96)

- Dornröschenschloss nach offiziellen Disney-Fotos angenähert: asymmetrische rosa Türme, geschwungene blaue Turmdächer, goldene Spitzen, schmale Fenster, Balkone, ovales Frontfenster, Steinsockel und offener Spitzbogen. Modellhöhe einschließlich Spitze 43 m gemäß Disney. Die Form bleibt eine dekorative Annäherung, keine Architekturaufnahme. Quellen: `sources/castle-model-reference.json`.
- Keine Dachschrift und keine erfundenen Fassadenschilder am Schloss. Andere Dach-/Fassadenbeschriftungen bleiben erhalten. Ein grüner, geduckter Drache mit Hörnern, Flügeln und eingerolltem Schwanz liegt am westlichen Schlossfuß in einer angedeuteten Felsnische als sichtbarer Hinweis auf die unterirdische Drachenhöhle. Navigationspin und Höhleneingang bleiben an den bisherigen Koordinaten.
- Nur der Schlossanteil der gemeinsamen Fantasyland-Gebäudefläche wird für das Rendering ausgespart, damit die alte vereinfachte Extrusion den Torbogen nicht verdeckt. Keine Änderungen an Wegen, Routing-Daten, anderen Landmarken oder Ziel-IDs. Wenige dekorative Bäume direkt in der Drachen-Nische entfernt. Reproduzierbar und idempotent über `prepare-building-shapes.py` und `prepare-roof-lettering.py`.
- Ein vorhandener statischer Mesh-Buffer und Draw-Call, keine neuen Bilder/Texturen/Shader. Kompakte Facettenzahl auf Handys und beim Recovery erhält alle Türme, Torbogen und Drachen. Statischer Gesamtmesh mit 600 Bäumen etwa 3,14 MiB; nach Context-Recovery mit 180 Bäumen etwa 1,90 MiB.
- 64 Node-Testdateien bestanden. Neuer Geometrietest prüft Höhe, freien Torbogen, niedrigen Drachen, Speichergrenze, kompakte Silhouette, fehlende Schlossbeschriftung und stabile Eingänge. Bestehende GPU-Zustands-/Cleanup-/Recovery-Tests erfolgreich. Vollständige App und Renderer unter Produktions-CSP auf 402 × 874 px geprüft; keine Browserfehler. Screenshots `Disney-Schloss-App-Build96.png` und `Disney-Schloss-Drache-Build96.png` im Aufgabenordner.
- App, HTML und Service-Worker auf Build 96; Update-Notiz in allen acht Sprachen.
- Auf weletapi veröffentlicht: acht Live-Dateien per SHA-256 verifiziert, PHP-Syntax und übersetzte Release-Notiz geprüft. Authentifizierung unverändert. Backup: `/var/backups/weletapi-disney/build96-20261006-212722`.

### Eingang, Earffel Tower, Bahnhöfe und Gleise (Build 97)

- Foto-informierte 3D-Geometrie: Adventure-World-Eingang mit offenem Rundbogen, geschwungener Krone, orangefarbenen Wandflächen, cremefarbenen Gesimsen, grünen Fächern, Metalltoren, Ornamenten und Laternen. Die fünf erfassten Einlassdächer werden nur in der Darstellung durch das zusammenhängende Modell ersetzt. Ground- und Navigationsdaten bleiben unverändert.
- Earffel Tower sitzt auf dem tatsächlichen OSM-Grundriss (`way49734660`): offenes Stahlgestell, Querstreben, Leiter, Tankunterseite, Umlaufgeländer, dunkle Dachkappe und zwei räumliche Mickey-Ohren. Name direkt auf die gekrümmte Tankfläche gemalt. Höhe 33 m aus dem OSM-Bestand; weitere Detailmaße sind Annäherungen anhand der privaten Nutzerfotos. Keine Nutzerfotos oder Personen werden als Texturen veröffentlicht.
- Hollywood Tower mit unterschiedlichen oberen Flügeln, gestaffelten Gesimsen, Kuppel, gerahmten Fenstern, Rücksprüngen, verwitterten Wandpartien und offener Lift-Bay-Anmutung. Originale vierzeilige Fassadenaufschrift auf der Gebäudefront; keine zusätzliche künstliche Dachschrift. Bestehende Landmarkposition/Höhe und Eingang bleiben erhalten.
- Beide gewünschten Bahnhöfe: Main Street Station mit erhöhten Durchgängen, Seitentreppen, gläsernem Bahnsteigdach, ornamentierter Front, Uhrgiebel und Geländern; Marne-la-Vallée–Chessy mit Glashalle, Dachrippen, rotem Säulenpaar, Eingangsuhr und SNCF-/Bahnhofsaufschrift am südlichen Ende. Grundflächen aus OSM; Formen und Materialien bleiben leichte dekorative Annäherungen, keine fotogrammetrische Architekturaufnahme. Quellen: `sources/park-detail-references.json`.
- 57 sichtbare Bahnlinien aus Originalgeometrie mit Schienen, Schwellen und tatsächlicher Spurweite (Disneyland Railroad 914 mm), zusätzlich 34 Ausschnitte erfasster Zäune am Eingangsbereich. Unterirdische TGV-/RER-Abschnitte erscheinen nicht an der Oberfläche. Die ausdrücklich überdachte Main-Street-Brücke wird erhöht gezeichnet; Gleise liegen zwischen Frontgebäude und Bahnsteigdach. Keine Bahnlinie wird als Fußweg oder Navigation aufgenommen.
- `prepare-park-details.py` liefert Metadaten für den bestehenden Gebäude-/Dachgenerator. Idempotent und reproduzierbar; alle Original-Fußwege, GPS- und Routing-Ziele unverändert. 37 Fassadenbeschriftungen im bestehenden Atlas, davon zwei als gekrümmte Decals; 120 übrige gemalte Dachschriften. Kein neuer Mesh-Draw-Call, keine externen Texturen oder zusätzlichen WebGL-Kontexte. Weniger Streben, Dachfacetten und Schwellen auf Handys und beim Recovery.
- 65 Node-Testdateien bestanden. Geometrie-/GPU-Tests umfassen offene Turmstützen, zylindrisches Logo, Quellanker, erhöhte Gleise, Spurweite, degenerierte Zaunsegmente, Fassadenatlas, Cleanup und Recovery. Mobile Vorschau (402 × 874 px) unter Produktions-CSP geprüft; alle fünf Modellansichten, Zoom und Drehung ohne Browserfehler. App/HTML/SW Build 97 mit Update-Notiz in acht Sprachen.
- Gemessener statischer Gesamtmesh: Desktop mit 1.800 Bäumen 10,08 MiB, Handy mit 600 Bäumen 4,88 MiB, Recovery mit 180 Bäumen 3,64 MiB.
- Auf weletapi veröffentlicht: acht Live-Dateien per SHA-256 verifiziert, PHP-Syntax und mehrsprachige Release-Notiz geprüft. Zugriff weiterhin anmeldungsgebunden. Backup: `/var/backups/weletapi-disney/build97-20261007-073615`. Fünf Modellansichten und Gesamtansicht als PNGs im Aufgabenordner gesichert.

### RER, einfache Weltansicht und Dachfahnen (Build 98)

- Leichte RER-A-Darstellung von Marne-la-Vallée–Chessy bis zum unterirdischen RER-Halt Gare de Lyon: rund 34,2 km, 14 Bahnhöfe, tatsächliche OSM-Geometrie und gestrichelte Tunnelabschnitte. Stationsnamen/-koordinaten von Île-de-France Mobilités, Streckenverlauf gegen deren geografischen Datensatz geprüft. Keine Eisenbahnlinie im Fußwegenetz; keine regionalen Schwellen-/Gebäudemodelle. Offline-Referenz `sources/rer-a-reference.json`, reproduzierbar mit `prepare-rer-rail.py` und dem bestehenden Parkgenerator.
- „RER A bis Paris anzeigen“ in den Karteneinstellungen; 3D-Auswahl bleibt aktiv. Die 3D-Übersicht nutzt die eigene Kamera zum Einpassen und behält keine temporären Kartenränder für nachfolgende Ansichten. Bahnhöfe und Umrisse bleiben bewusst einfach.
- Ausschließlich die 3D-Karte erweitert ihre Zoomstufen: grober Paris-Stadtumriss, Kontinente, drehbare Weltkugel vor dunklem Hintergrund. Grün für Land, Blau für Wasser. Keine zusätzlichen Weltkarten-Details, externen Bildkacheln oder neuen Renderer-Kontexte. Natural-Earth-Landflächen (110m, gemeinfrei) und offizieller Paris-Umriss aus geo.api.gouv.fr, zusammen etwa 150 KB. Quellen/Lizenzen in `sources/world-overview-references.json`.
- MapLibre v6 wechselt unter Zoom 8 von Mercator zur Kugelprojektion. Parkdetails und ihre Custom-Meshes werden unter Zoom 14 nicht gezeichnet; Bahn-/Stationssymbole verschwinden unter Zoom 7. Bestehende GPU- und Recovery-Budgets bleiben erhalten.
- Sieben Dachfahnen ersetzen zu kleine oder über mehrere Dachflächen verzerrte Schriften, einschließlich Arendelle an der höchsten Turmspitze. Die übrigen 113 gemalten Dachschriften bleiben bestehen; das Märchenschloss bleibt ohne Beschriftung. Flaggenmast direkt am tatsächlichen höchsten Dachpunkt; klein unterteiltes Tuch mit sanfter GPU-Bewegung. Kleiner eigener Textatlas, begrenzter Repaint-Takt, Timer-/GPU-Cleanup beim Entfernen; in ausgeblendeten oder weit herausgezoomten Ansichten kein fortlaufendes Neuzeichnen.
- 67 Node-Testdateien erfolgreich. Geprüft: verbundene Bahngeometrie/richtiger Ast, Untergrundterminus, Kameraauswahl/Cache, einfache Weltfarben/Projektion, überschaubarer Speicher, Flaggenanker, entfernte Dachschrift, Schlossausschluss, Cleanup und bestehende Routing-/Update-/Offline-/Sprachfunktionen. Echte 3D-Renderer-Vorschau auf 402 × 874 px unter Produktions-CSP geprüft: Fahne lesbar, Bahnübersicht sichtbar, Weltkugel durch Ziehen von Europa/Afrika nach Amerika gedreht; keine neuen Rendererfehler. Screenshots im Aufgabenordner.
- Auf weletapi veröffentlicht: neun Live-Dateien per SHA-256, PHP-Syntax, Szenendaten und alle drei Release-Notizen in acht Sprachen geprüft. Zugriff weiterhin anmeldungsgebunden. Backup: `/var/backups/weletapi-disney/build98-20261007-081502`.

### Disney Village, PanoraMagique und weltweite Mickey-Pins (Build 99)

- Disney Village ergänzt anhand der vorhandenen OSM-Flächen: Gebäudefußabdrücke und benannte Gebäudeteile, kleine Fußwege, Village-Grundfläche und der vollständige Lac Buena Vista. `prepare-village.py` ist in den bestehenden Gebäude-/Dachgenerator integriert. 119 Village-Szenelemente; originale Parkwege, Ziel-IDs, 95 Rides und Routing-Daten bleiben erhalten. Village-Wege sind ausschließlich Darstellungsgeometrie (`village-path`), keine automatische Erweiterung des Fußwegenetzes.
- PanoraMagique über dem tatsächlich erfassten Liegeplatz (`way253840775`, 48.8690142 / 2.7871136): blau-weiß gestreifte Hülle mit goldgelbem Band, Nahtlinien, offene Ringgondel, Aufhängungen, Halteseil und schwimmende Plattform. Durchmesser 22,5 m und Gesamthöhe rund 35 m nach Betreiberangaben; dekorative Flugpose mit Gondel auf 80 m, kein Live-Flugstatus. Quellfoto ausschließlich als Modellreferenz; keine Bildtextur veröffentlicht. Referenzen in `sources/village-model-reference.json`.
- Sechs weltweit bestehende Disney-Destinationen ausschließlich mit Mickey-Silhouette und Namen: Disneyland Paris, Disneyland Resort (Kalifornien), Walt Disney World Resort (Florida), Tokyo Disney Resort, Hong Kong Disneyland Resort und Shanghai Disney Resort. Disney nennt diese Destinationen in seinem weltweiten Verzeichnis; Koordinaten aus OSM sind grobe Resortpositionen, keine Eingänge oder weltweiten Navigationsziele. `sources/disney-world-locations.json` enthält die Quellen. Keine ausländischen Gebäude-/Stadtmodelle.
- Mickey-Symbole als kleine native SVGs, bei Globe-Ansicht nur auf der sichtbaren Erdseite. Namen erhalten Kollisionsschutz und erscheinen bei Hover/Fokus wieder; Tippen zoomt zum jeweiligen Standort. In der Paris-Übersicht ergänzen Disneyland Park, Disney Adventure World und Disney Village die lokalen Namen. Marker werden beim Renderer-Neustart sauber entfernt. Stil und Zoomstufen der einfachen Weltansicht bleiben bestehen.
- 68 Node-Testdateien bestanden, einschließlich Orts-/Gondel-/Halteseilgeometrie, sechs Destinationen, Erdseiten-Sichtbarkeit und bisherigen Routing-/Sprach-/Offline-/GPU-Recovery-Prüfungen. Statischer Gesamtmesh etwa 10,28 MiB Desktop, 4,99 MiB Handy und 3,75 MiB Recovery; Ballonmodell allein 192 KB bzw. 90 KB kompakt. Reale mobile und breite 3D-Vorschau unter Produktions-CSP, Village/Ballon sowie Mickey-Weltansicht ohne Browserfehler geprüft. Screenshots `Disney-Village-Ballon-Build99.png` und `Disney-Mickey-Welt-Build99.png` im Aufgabenordner.
- App/HTML/SW Build 99 mit Update-Hinweis in acht Sprachen auf weletapi veröffentlicht. Neun Dateien per SHA-256, Szenendaten, Release-Übersetzungen und PHP-Syntax verifiziert; Zugriff weiterhin anmeldungsgebunden. Backup: `/var/backups/weletapi-disney/build99-20261007-083626`.

### Feste Sheet-Griffe und unterer Abstand (Build 100)

- Griffe und Schließen-Buttons bleiben außerhalb des scrollbaren Inhalts. Gemeinsamer innerer Scrollbereich für Dialog-Sheets und Navigation, mit 18 px unterem Innenabstand. Vier Detents und direkte, fließende Pointer-Gesten bleiben erhalten; beim Wechsel wird der innere Scrollbereich zurückgesetzt. Sprachwechsel bewahren die Scrollposition des Ziel-Sheets.
- Kleinste Navigationsansicht von 104 auf 128 px erhöht, entsprechend auch die Drag-Geometrie. Kompakte Playlist-Zeile mit 28 px Mindesthöhe. WC-Pause und Entfernung sind vollständig sichtbar, mit rund 34 px Abstand zum unteren Kartenrand in der geprüften 402 × 874 px Ansicht.
- 68 Node-Testdateien bestanden, inklusive direkter erster Aufwärtsgeste und neu geprüftem Zurücksetzen des inneren Scrollbereichs. Reale Browserprüfung mit Produktions-CSS, tatsächlichem Navigations-/Dialog-Markup und surfaces.js unter Produktions-CSP: normale, größere und Vollbild-Ansichten scrollen im Inhalt; Griffposition unverändert, äußerer Scrollwert 0. Direktes Ziehen nach Scrollen, Minimum-Titel, modale Sheets, RTL und Benachrichtigung oberhalb des Vollbild-Sheets geprüft. Keine Browserfehler. Vorschau: `Sheet-Abstand-Build100.png` im Aufgabenordner.
- Build 100 auf weletapi veröffentlicht, sieben Dateien per SHA-256, PHP-Syntax und Update-Hinweis in allen acht Sprachen verifiziert. Backup: `/var/backups/weletapi-disney/build100-20261007-090420`.

### Spider-Man-Eingang am Nutzerstandort (Build 101)

- Nutzerkorrektur anhand des blauen Punkts im Screenshot vom 07.10.2026: Spider-Man W.E.B. Adventure hat seinen Eingang am öffentlichen Fußweg zwischen Stark Factory und Spider-Man. Routenziel/Pins von OSM-Knoten 10704734313 auf 10024532531 (`48.865977 / 2.7795707`, Graphknoten 2782, Fußweg 1075097370) gesetzt. Die Korrektur ist als Nutzerbestätigung mit gemeldeter GPS-Genauigkeit ±5 m dokumentiert, nicht als neue OSM-Türvermessung. 53,5 m räumliche Verlegung beseitigt den etwa 99 m langen Umweg vom gemeldeten Eingang zum alten Pin.
- `sources/ride-entrances.json`, `sources/location-audit.json` und Daten-Revisionsnummern angepasst; beide Eingangs-/Auditgeneratoren erhalten die Korrektur samt Herkunft/Datum. Alle Graphknoten, Kanten, Pfade und die anderen 94 Ziele unverändert. Gemeinsame Zielkoordinate für 2D/3D-Pin, Routing und Ankunftserkennung. Datenabrufversion 42.
- 68 Node-Testdateien erfolgreich, einschließlich gezielter Null-Reststrecke am bestätigten Eingang, direktem südlichem Zugang unter 10 m, Ende aller 95 Routen am jeweiligen Pin und Erreichbarkeit in beide Richtungen. Wiederholter Eingangsgenerator liefert identische Daten.
- Build 101 und Update-Hinweis in acht Sprachen auf weletapi veröffentlicht; sechs Live-Dateien per SHA-256, PHP-Syntax und tatsächlicher Spider-Man-Zielknoten verifiziert. Backup: `/var/backups/weletapi-disney/build101-20261007-094650`.

### Optionale iPhone-Modellfrage nach einem Crash (Build 102)

- Modellfeld aus Info/Einstellungen entfernt. Nach `context-lost`, `failed` oder einer aus dem lokalen Checkpoint erkannten vorigen Unterbrechung wird auf iOS bei unbekanntem Modell optional gefragt. Kein Prompt beim gesunden Start, bei normalen Renderereignissen, auf Desktop/Android oder durch den manuellen Diagnose-Button. Bestehende Werte im lokalen Schlüssel `disney:diagnostic-model` werden übernommen.
- „Speichern“ bestätigt das Modell, persistiert es ausschließlich lokal für künftige Berichte und ergänzt den aktuellen technischen Bericht. Eingabe allein speichert nicht. „Überspringen“, Schließen oder leere Bestätigung senden ohne Modell; eine abgelehnte Frage wird innerhalb derselben App-Sitzung nicht wiederholt. Validierte gespeicherte Modelle verhindern die nächste Frage auch nach einem Neustart. Androids Browser-Modellermittlung bleibt erhalten.
- Frage auch ohne Netzwerk; ausstehender Bericht bleibt lokal und wird bei Verbindung mit der Antwort gesendet. Gemeinsame Promise verhindert mehrere Modellfragen bei parallel auftretenden Fehlern, Bericht erfasst nach Antwort den neuesten gesammelten Fehler. Vorhandene Sanitization, CSRF, Größen-/Rate-Limits und Ausschluss von GPS, Route und Kontodaten unverändert.
- Dialog und Update-Hinweis in acht Sprachen. 68 Node-Testdateien erfolgreich, erweitert um gesunden Start, manuelles Senden, ersten Crash, lokales Wiederverwenden, Überspringen, Offline-/unterbrochenen Neustart und konkurrierende Fehler. Mobile Browserprüfung 402 × 874 px unter Produktions-CSP mit tatsächlichem Dialog, Diagnose- und Surface-Code: Speichern, Überspringen, X, Neustart ohne erneute Frage sowie französischer Dialog erfolgreich; lokaler Test-POST enthält bestätigtes Modell. Keine Browserfehler. Vorschau `iPhone-Crash-Abfrage-Build102.png` im Aufgabenordner.
- Build 102 auf weletapi veröffentlicht; sieben Dateien per SHA-256, PHP-Syntax, Release-Übersetzungen und entfernte Einstellung/neuer Dialog verifiziert. Backup: `/var/backups/weletapi-disney/build102-20261007-095911`.

### X innerhalb des Suchfelds (Build 103)

- Gemeinsamer innerer Suchfeld-Container für Favoriten/Entdecken und die Ortssuche. Das X liegt über dem rechten Ende des Eingabefelds innerhalb des Fokusrahmens; 48 px Textabstand und 44 px Trefferfläche. Logische Abstände unterstützen RTL. „Fertig“ bleibt neben dem Feld.
- Bestehende Löschfunktion leert die Suche, rendert Ergebnisse neu und erhält Fokus sowie Filter. X nur bei Inhalt sichtbar.
- Alle 68 Node-Testdateien erfolgreich. Mobile Browserprüfung 402 × 874 px mit tatsächlichem Markup, Produktions-CSS und Löschhandlern unter Produktions-CSP: X geometrisch vollständig im Eingabefeld, „Fertig“ außerhalb, beide Suchen leeren sich und bleiben fokussiert. Keine Browserfehler. Vorschau `Suche-X-im-Feld-Build103.png` im Aufgabenordner.
- Build 103 auf weletapi veröffentlicht; sechs Live-Dateien per SHA-256, PHP-Syntax, Version, Übersetzungen und beide Suchfeld-Container geprüft. Backup: `/var/backups/weletapi-disney/build103-20261007-100909`.

### Öffentliche App in Docker (Build 104)

- Ziel: `https://abetterdisneylandparisapp.weletapi.com/`, ausdrücklich ohne Login. Eigenes Projekt `/mnt/backup/docker-projects/disney-public`, eigene Docker-Bridge und vier ausschließlich für die App angelegte Docker-Volumes für Gerätekennung, öffentliche Wartezeitdaten, technische Fehlerberichte und opt-in Web Push. Kein Host-Webroot, Auth-Verzeichnis oder Docker-Socket im Container.
- Das Image enthält PHP/Apache, Node und sämtliche App-Assets. Öffentlicher Controller und Collector sind zusätzlich als schreibgeschützte Dateien aus dem eigenen SSD-Release eingebunden, damit kleine Anpassungen keinen teuren VFS-Neubau benötigen. Ein App-Container auf `127.0.0.1:18081`; ein kleiner Supervisor überwacht Webserver und Hintergrundsammler gemeinsam und startet den Container bei einem Prozessausfall neu. Prozesse als www-data, schreibgeschütztes Root-Dateisystem, keine Capabilities, 256 MiB RAM / 512 MiB inklusive Swap, 1,5 CPU und rotierende Docker-Logs. Kein neuer Host-Cronjob. Host-Apache enthält nur die Weiterleitung der Alt-Adresse und eine eng begrenzte statische Umzugs-Aktualisierung für bisher installierte PWAs; die App selbst läuft ausschließlich im Container.
- Eigener öffentlicher Controller mit exakter Asset-Allowlist. Öffentliche Daten-APIs, PWA-Manifest, Worker und Web-Push funktionieren am Domain-Root; lokale Vorschau bleibt erhalten. Signierte HttpOnly/Secure/SameSite-Gerätekennung statt weletapi-Konto, eigener CSRF-Schlüssel und neu erzeugte VAPID-Schlüssel. Browser-Favoriten unter stabiler lokaler Kennung `disney:public`. Kinderangaben und GPS-Koordinaten werden weiterhin nicht an den Server gesendet.
- Eine kurzzeitig nicht erreichbare öffentliche API lässt eine bereits offene Route bestehen. Cookie bereits im ersten HTML-Aufruf vermeidet unterschiedliche Kennungen bei parallel startenden API-Anfragen. Origin-Prüfung auf exakt die öffentliche Domain, Fehlerdaten weiterhin privat mit vorhandener Validierung und Ratenbegrenzung.
- 69 Node-Testdateien erfolgreich, zusätzlich neuer Test für öffentliche Root-APIs, Push, stabile lokale Einstellungen, temporären Ausfall und separate Docker-Volumes. Alle fünf PHP-Testdateien und Syntaxprüfungen im tatsächlichen Container-Image bestanden, einschließlich signierter Gerätekennung.
- Der vorhandene Docker-Host verwendet VFS. `docker/build-flat.sh` baut dafür aus offiziellen PHP-/Node-Laufzeiten ein einzelnes Dateisystem und importiert ein Image mit nur einer Schicht; für andere Speichertreiber bleibt das normale Dockerfile verfügbar. Kein Wechsel des globalen Docker-Speichertreibers. Wiederverwendbare Node-/Web-Push-Dateien bleiben ausschließlich im App-Projekt.
- SSD-Vorgabe: Docker-Daemon, Images, Container-Dateisysteme, Logs und Volumes auf `/mnt/backup/docker` (SSD /dev/sda1, SNVS2000G, ROTA=0); Projekt, Quellarchive und Build-Cache auf `/mnt/backup/docker-projects/disney-public`. Kein Projekt-/Build-Bestand auf dem internen eMMC-Laufwerk.

- Veröffentlichung geprüft: HTTPS-HTML, signierte Cookie-Attribute, öffentliche Session/Version 104, statische MIME-Typen, beide Worker, PWA-Manifeste, aktuelle Wartezeiten/Showzeiten, private Pfade, CSRF- und Origin-Abweisung. HTTP leitet auf HTTPS um. Eigener Container gesund, ohne Neustarts. Dateiinventar per SHA-256 geprüft; Ergebnis auf SSD unter `tools/runtime-verification.txt`.
- Bisherige Host-App, zwei Disney-Cronjobs und die drei privaten Host-Datenverzeichnisse archiviert unter `/mnt/backup/docker-projects/disney-public/backups/host-retirement-20261007-112122` (0700). Laufende alte Disney-Collector-Prozesse beendet; andere weletapi-Dienste und geschützte interne Tools unverändert.
- `docker/legacy-migration-sw.js` wird am ursprünglichen Service-Worker-Pfad `https://weletapi.com/files/.internal/Disney/sw.js` als JavaScript mit HTTP 200, `no-store` und eng begrenztem Worker-Scope ausgeliefert. Ohne Redirect/Login, damit die bereits installierte Handy-App das Update tatsächlich akzeptieren kann. Aktivierung navigiert ausschließlich alte Disney-Fenster zur neuen Domain; spätere Navigationen werden ebenfalls weitergeleitet. Lokaler Browser-Speicher und Caches bleiben unangetastet. Nur bekannte Zielparameter werden übernommen, keine privaten Query-Parameter. Node-Regressionstest und Live-Header-/SHA-Prüfung bestanden.
- iOS speichert die Startadresse eines bestehenden Home-Bildschirm-Symbols lokal: der Umzugs-Worker kann die App weiterleiten, die Installation selbst aber nicht auf eine andere Domain umschreiben. Für ein direktes neues Symbol neue Adresse in Safari öffnen und zum Home-Bildschirm hinzufügen; für einen direkten Test auf dem Nutzer-iPhone besteht kein Gerätezugriff.
- Besonderheit der Host-Konfiguration: `/etc/apache2/sites-enabled/weletapi-ssl.conf` ist eine eigene reguläre Datei statt eines Symlinks. Die Migration wurde in dieser tatsächlich aktiven Datei installiert und nach graceful Reload öffentlich geprüft; die zuvor getrennte `sites-available`-Datei wurde ebenfalls gesichert. Reproduzierbarer, eng begrenzter Ausschnitt: `docker/legacy-migration-apache.conf`.

### Favoriten im Start-Assistenten, keine Weiterleitung (Build 105)

- Erststart, absichtlich leere Auswahl und beschädigter lokaler Speicher starten ohne vorausgewählte Favoriten. Historische `defaultsVersion`-Marker führen nicht mehr zum automatischen Ergänzen der alten 15er-Liste. Bestehende gespeicherte Favoriten und besuchte Ziele bleiben erhalten.
- Nach den Kinderangaben folgt eine freiwillige Auswahl aus den Best Rides, nach derselben Besucherbewertung und Mindestanzahl von Bewertungen wie die bestehende Top-Rides-Liste. Native Checkboxen, Parkname, Sterne und gegebenenfalls Größenhinweise; alle zunächst leer bei einer Neuinstallation. Änderungen bleiben bis „Auswahl übernehmen & weiter“ als Entwurf. „Später auswählen“ übernimmt nichts. Fehler beim Speichern lassen die Auswahl offen und stellen die bisherigen Favoriten wieder her.
- Alle neuen UI-Texte und die Release-Notiz in acht Sprachen. Sprachwechsel erhält den Entwurf und die Scrollposition; nachträgliche Installationsereignisse überspringen keinen laufenden Familien-/Favoritenschritt. Kein automatischer Neustart des Assistenten bei schon abgeschlossener Einrichtung.
- Alte Server-Weiterleitung entfernt: historische Disney-URLs antworten HTTP 410 statt Redirect. Ein winziger Shutdown-Worker an der ursprünglichen Worker-Adresse ersetzt das zuvor installierte Umzugs-Update und meldet sich ab. Keine Navigation, neue Weiterleitung oder Löschung des lokalen Speichers; andere weletapi-Sites bleiben unberührt.
- 71 Node-Testdateien bestanden, einschließlich Erststart/alter Versionsmarker/leerer oder beschädigter Speicherung, Reihenfolge und fehlender Vorauswahl, Entwurf/Speichern/Überspringen, Speicherfehler, Familien-/Berechtigungsfluss, Sprache und Worker-Abmeldung.
- PHP-/Node-Laufzeit unverändert aus dem geprüften Build-104-Image; eigene schreibgeschützte App-Dateien zusätzlich vollständig aus dem SSD-Release nach `/var/www/html` eingebunden, mit gesondertem öffentlichen Controller. Dadurch vermeiden kleine App-Updates einen auf diesem VFS-Host teuren Runtime-Neubau. Container, Limits, private Volumes und SSD-Vorgabe unverändert.
- Live geprüft: 432 ausgelieferte Dateien per SHA-256, vollständige öffentliche Daten-/Push-/Diagnose-Prüfung, HTTP 410 an allen alten App-Adressen ohne Location-Header, Shutdown-Worker exakt geprüft und fremde Tools weiterhin geschützt. Container gesund mit 0 Neustarts. Sicherung der Weiterleitungsentfernung: `/mnt/backup/docker-projects/disney-public/backups/remove-redirect105-20261007-114557`.
- Reale Browserprüfung: leerer Erststart, zwei gezielt gesetzte Häkchen, Französisch und arabisches RTL bei 402 × 874 px ohne Überbreite/Verlust der Auswahl, Speicherung exakt dieser zwei Favoriten. Live-Update über Info → Update installieren zeigt App 105 / Server 105; alle 15 bereits gespeicherten Testfavoriten erhalten. Screenshot des neuen Schritts: `Disney-Favoriten-Assistent-Build105.png` im Aufgabenordner (lokale Vorschau). Live-Nachweis: `Disney-Public-Build105.png`.

### 3D als Standardkarte (Build 106)

- `loadMapMode()` öffnet beim ersten Start aktiv die 3D-Parkkarte. Fehlende/ungültige Kartenpräferenz und nicht verfügbarer Browser-Speicher verwenden ebenfalls 3D. Explizit gespeicherte Wegekarte, Disney-Original oder 3D bleiben erhalten; bestehende Navigation übernimmt weiterhin die 3D-Auswahl.
- Kartenpräferenz-/Navigations-/Renderer-/Recovery-Tests sowie App-Update, Offline-Cache und Übersetzungen geprüft. Release-Notiz in acht Sprachen. Neue Favoritenauswahl und leerer Erststart aus Build 105 bleiben erhalten.
- Browser-Erststart geprüft: 3D-Canvas sichtbar, Karteneinstellungen nicht manuell betätigt, kein Rendererfehler, keine Standard-Favoriten. Screenshot `Disney-3D-Standard-Build106.png` zeigt die automatisch gestartete Karte in der lokalen Vorschau. Die Python-Vorschau hatte beim ersten Laden drei fehlgeschlagene Skriptabrufe; nach erneutem Laden war der Renderer verfügbar. Kein entsprechender Fehler in der veröffentlichten Dateiprüfung.
- Build 106 öffentlich veröffentlicht; 432 App-/Controller-Dateien per SHA-256 und öffentliche HTML-/Versions-/Worker-Antworten einschließlich tatsächlichem 3D-Initializer geprüft. Eigener SSD-Docker-Betrieb unverändert.


## Build 107 · Startbildschirm und Fehlerbehandlung

- Splash-Screen mit Ladeindikator direkt im HTML, bevor App-Abhängigkeiten geladen werden. Unterliegende Bedienelemente sind während des Starts inert. Verschwindet nach Daten, Worker und ausgewählter Karte; ein 3D-Ladefehler öffnet die unabhängige Karten-Fehleransicht und lässt die restliche App weiter starten.
- Fehlende 3D-Datei, synchroner Rendererfehler und abgewiesener Open-Promise brechen die App-Initialisierung nicht ab. Die 3D-Auswahl bleibt gespeichert.
- Session- und Parkdatenanfragen sind begrenzt; Worker-Initialisierung hat 15 Sekunden Deadline. Der Splash bietet nach Ladefehlern oder 45 Sekunden einen Cache-bust-Neustart an; lokaler Speicher wird nicht gelöscht.
- Routen-Worker und sein Routing-Import sind mit Build 107 versioniert. Acht semantisch übersetzte Sprachen, CSP unverändert (Startsteuerung aus eigener JS-Datei).
- Diagnose vor Änderung: App-Container gesund, null Neustarts, öffentliche Datenantworten 200; keine Fehlerberichte im neuen eigenen Diagnose-Volume. Live-Browser aktualisiert auf 106 und startet mit 3D ohne Konsolenfehler. Die konkrete Ursache am iPhone ist damit nicht nachgewiesen; behoben sind die gefundenen Fehlerpfade beim Start.
- Vorabprüfung: 72/72 Node-Testdateien bestanden, einschließlich Splash-Timeout/Retry, fehlenden kritischen Scripts, optionalem 3D, Worker-Deadline und vorhandenen Favoriten-/Onboarding-/Kartenprüfungen.

- Lokale Browserprüfung: Ladebildschirm mit animiertem Spinner sichtbar; mit künstlich 20 Sekunden verzögerter Parkdatenantwort sauberer Timeout nach 15 Sekunden und bedienbares Retry. Retry setzt `_update`, normaler Folgestart öffnet Assistent und 3D-Karte; Splash verborgen, Navigation nicht inert, kein Kartenfehler. Ein Konsoleneintrag `TimeoutError` stammt aus dem absichtlich unterbrochenen Test.
- Vorschau-Screenshot: `Disney-Startbildschirm-Build107.png` (lokale App bei absichtlich langsamem Parkdatenabruf).


## Build 108 · Korrektur nach öffentlicher Cache-Prüfung

- Build 107 startet öffentlich im Browser mit Splash und 3D ohne Konsolenfehler. Bei der Live-Prüfung war `sw.js` jedoch noch Build 106 (`CF-Cache-Status: HIT`, Age 1073, max-age 14400); `sw.js?v=107` lieferte korrekt Build 107 (`MISS`). Ein alter Service Worker wird vor dem Server länger zwischengespeichert.
- Die bestehende Service-Worker-Registrierung erhält jetzt pro Build eine versionierte Script-URL (`sw.js?v=108`), Scope bleibt `./`. Das aktualisiert dieselbe Registrierung und erhält vorhandene Push-Abonnements. Die Origin-Antwort für `sw.js` verwendet wieder `no-store`. Bereits im vorgeschalteten Cache gespeicherte unversionierte Kopien laufen regulär aus; App-Registrierung verwendet sie nicht mehr.
- Splash und abgesicherter Start aus Build 107 unverändert; Worker und UI-Abhängigkeiten für 108 versioniert. Dies ist ein nachgewiesener Update-Cachefehler, kein Nachweis der konkreten Ursache des gemeldeten iPhone-Abbruchs.

- Build 108 Oberfläche auf 402 × 874 geprüft: Splash füllt den Viewport ohne horizontalen Überlauf; Screenshot `Disney-Startbildschirm-Build108.png` aus lokaler Vorschau mit absichtlich verzögerter Datenantwort. Gezielte Start-/Cache-/Update-/Public-/i18n-Tests nach Cache-Korrektur bestanden.

- Endprüfung Build 108: 433 ausgelieferte Dateien SHA256 bestätigt; öffentliche HTML-/API-Version und `sw.js?v=108` korrekt, Container healthy ohne Neustarts. Öffentlicher Update-Button 107→108 startet App mit 3D ohne Konsolenfehler.
- Screenshot des Nutzers 14:31 (106→107: Update-Prüfung nicht möglich) fällt in den Containerwechsel zu 108. VFS hatte den alten Container schon beendet, während der neue noch aufgebaut wurde. Deployment daher korrigiert: `docker create` läuft jetzt bei weiter laufender App; erst danach Stop/Rename/Start. Vorbereitung vor Ausfall sowie Wiederherstellung bei Start-/Health-Fehlern mit Fake-Docker-Test geprüft; keine weitere Unterbrechung zum Prüfen erzeugt. Ein kurzer Wechsel zwischen Stop/Start bleibt erforderlich.


## Build 109 · Einführung unter /, App unter /App

- Statische, ohne JavaScript lesbare Einführung mit semantischer H1/H2/H3-Struktur, Funktionsübersicht, direkten App-Links und responsiver SVG-Parkillustration. Acht bedeutungsgetreue Sprachen, RTL für Arabisch; kein zusätzliches Bild-/Frontend-Framework.
- SEO: beschreibender HTML-Titel, Meta-Beschreibung, Root-Canonical, OpenGraph, WebApplication-JSON-LD, robots.txt und Sitemap mit genau der öffentlichen Einführung. App-Oberfläche hat noindex/follow und Canonical auf /App/. Keine erfundenen Bewertungen oder Ranking-Versprechen. Übersetzte Metadaten bleiben bei Sprachwechsel erhalten.
- /App wird auf /App/ normalisiert; relative Assets und APIs funktionieren unter /App/. Root-API/Legacy-Assets bleiben für offene ältere Clients erreichbar. Historische root index.html und Update-/Push-Links öffnen /App/ mit ihren Parametern.
- Installations-ID bleibt /; start_url und Manifest-Scope werden /App/. Der bestehende Root-Service-Worker erhält dieselbe Registrierung und die neue Build-URL; er lädt statische Assets unter /App/ und öffnet Benachrichtigungen ausschließlich in App-Fenstern. Bereits installierte iOS-/Standalone-Rootstarts gelangen in die App. Favoriten-Namespace und Daten bleiben am gleichen Origin.
- DISNEY_APP_URL explizit /App/ im Deployment, auch bei Wiederverwendung der geprüften Runtime. Eigener Docker-Container/Volumes auf SSD bleiben erhalten.
- Vorabprüfung: PHP-Controller syntaxgültig, PWA-Pfad-/Push-/Update-/i18n-/Deployment-Tests bestanden. Mobile Einführung bei 402×874 in allen acht Sprachen ohne horizontalen Überlauf; Metadaten und arabische Schreibrichtung geprüft.
- Im vollständigen Regressionstest fiel eine schon vorhandene Abweichung zweier Single-Rider-Mappings auf: 10948/10945 statt tatsächlich öffentlicher 10848/10845. Mit öffentlicher Wartezeiten-API und Katalog bestätigt und korrigiert, einschließlich zugehöriger 10849/10846. Der vorhandene neun-Rides-Test besteht wieder.

- Endprüfung: 73/73 Node-Testdateien lokal bestanden. Relevante App-Pfad-/Public-/Update-/Push-/Cache-/i18n-/Start-/Single-Rider-Tests und Rollback-Test zusätzlich auf dem Server bestanden. Der Versuch aller Quelltests im schlanken Release endete an einer nicht mitgelieferten historischen `osm-source.json`-Fixture; vollständige Quelltests laufen deshalb lokal.
- Live bestätigt: 438 Runtime-Dateien per SHA-256, Einführung/JSON-LD, /App/ und /App-Normalisierung, Legacy-Update-Links, Root-/App-APIs, Manifest-ID, versionierter Root-Worker, robots.txt und Sitemap. Container healthy, 0 Neustarts.
- Browser: tatsächlich über Info aktualisiert 108→109; URL wechselt von Root nach /App/, 3D startet ohne Konsolenfehler, alle 15 gespeicherten Testfavoriten exakt erhalten. Einführung öffentlich ohne Konsolenfehler. Screenshot `Disney-Startseite-SEO-Build109.png` im Aufgabenordner.
- Lokale App-Vorschau hatte beim ersten Aufruf einen fehlgeschlagenen Abruf von queue-dwell.js; der vorhandene Retry startete anschließend regulär. Dieser Fehler trat beim öffentlichen Update nicht auf.


## Build 110 · a better Disneyland Paris App

- Neuer Produktname für Webseite, SEO-/Social-Metadaten, strukturiertes WebApplication-Objekt, App-Titel, Startbildschirm, Einrichtungstexte und alle acht Installationsmanifeste. PWA-ID, /App/-Startadresse, Root-Worker-Scope und lokaler Favoritenspeicher bleiben stabil. Short name: a better DLP App.
- Startseite neu gestaltet: warme helle Fläche, dunkelgrüne Typografie, Limetten-/Rosa-Akzente, große Markenschrift, echter Screenshot der mobilen 3D-App in geneigtem Handyrahmen, grafische Funktionskarten und deutlicher App-Einstieg. Die App-Vorschau ist als Ganzes ein Link zur App; keine nachgebildeten funktionslosen Bedienelemente.
- Dezente Einblendung beim Laden/Scrollen und Sternbewegung, mit vollständiger Berücksichtigung von prefers-reduced-motion. Ohne JavaScript bleibt der Einführungstext lesbar; Karten werden nur bei verfügbarem Observer für die Einblendung vorbereitet.
- Acht bedeutungsgetreu übersetzte Sprachen, englischer Produktname bewusst unverändert. Mobile Prüfung 402×874 für alle acht Sprachen: keine horizontale Überbreite, korrekte Titel/Gratis-/Registrierungslabels, Arabisch RTL. Funktionskarten tatsächlich beim Scrollen eingeblendet.
- Öffentliches Info-Panel nennt für den App-Start korrekt nur die benötigte Verbindung; veralteter Satz mit weletapi-Login entfernt. Keine Änderung der Serverrechte oder API-Identität.
