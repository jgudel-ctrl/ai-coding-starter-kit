# PROJ-24: Easybill Partner-Sync via Webhook

> Status: ✅ Deployed | 2026-07-10 09:06 UTC  
> Verantwortlich: Jan Bernd Gudel / Klausi  
> Priorität: Hoch (67 fehlende Kunden, keine Neuanlage seit ~4 Wochen)

---

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Einen automatischen Sync, der neue Kunden aus Easybill in unsere Superbays-Datenbank überträgt — sobald sie in Easybill angelegt oder geändert werden. Das passiert über einen Webhook (wie ein Postbote, der direkt an unsere Tür klopft, statt dass wir stündlich beim Briefkasten nachschauen).

**Was Jan Bernd dadurch erreicht:**
- **Keine verlorenen Kunden mehr:** Wer in Easybill angelegt wird, ist sofort auch im TMS
- **Keine "Wer ist das?"-Rechnungen mehr:** Rechnungen kommen automatisch mit korrektem Kunden-Link an
- **Aktuelle Adressdaten:** Adressänderungen in Easybill landen automatisch bei uns
- **Kein manuelles Nachtragen:** Spart Zeit, vermeidet Fehler

---

## IST-Stand (2026-07-10)

### Bereits erledigt:
- ✅ **Initial-Import abgeschlossen:** 4 fehlende Kunden importiert (alle mit Warnungen wegen fehlender E-Mail)
- ✅ **Total in DB:** 2.658 Kunden (inkl. 44 Dubletten deaktiviert)
- ✅ Webhook konfiguriert (ID: **37919**)
- ✅ App-Proxy angepasst → Webhooks ohne Login-Prüfung
- ✅ Sync-Funktion gefixt (Schema `tms` statt `public`)
- ✅ Test erfolgreich: Partner wird korrekt angelegt
- ✅ Dubletten-Check initial (44 Dubletten gefunden/deaktiviert)
- ✅ Kundensuche: Toggle für aktive/inaktive Kunden

### Noch offen (PROJ-24 Scope):
1. **Stündlicher Fallback-Cronjob** — Wenn Webhook mal nicht ankommt
2. **Geoapify-Adressvalidierung** — Adressen prüfen und korrigieren

---

## Aufgaben & Akzeptanzkriterien

### 1. Initial-Import der 67 fehlenden Kunden

**Was:** Alle Easybill-Kunden, die noch nicht in unserer `tms.partners` Tabelle sind, importieren.

**Ablauf:**
1. Alle aktiven Easybill-Kunden abrufen (`GET /customers`)
2. Für jeden Kunden prüfen: Existiert `easybill_customer_number` schon bei uns?
3. Falls NEIN → Sync-Logik ausführen (wie beim Webhook)
4. Ergebnis loggen: Wie viele neu, wie viele übersprungen, Fehler

**Akzeptanzkriterien:**
- [ ] 67 fehlende Kunden sind importiert
- [ ] Adressen, Kontakte, Billing-Einstellungen sind dabei
- [ ] Dubletten-Prüfung läuft automatisch pro Import
- [ ] Fehler werden geloggt

### 2. Stündlicher Fallback-Cronjob

**Was:** Jede Stunde prüfen, ob neue/geänderte Kunden in Easybill sind.

**Ablauf:**
1. Cronjob läuft stündlich (z.B. :05 nach jeder Stunde)
2. Holt alle Kunden, die seit letztem Lauf geändert/erstellt wurden
3. Gleiche Sync-Logik wie Webhook
4. Ergebnis in Logs speichern

**Akzeptanzkriterien:**
- [ ] Cronjob läuft zuverlässig stündlich
- [ ] Nur geänderte/neue Kunden werden verarbeitet
- [ ] Identische Sync-Logik wie Webhook
- [ ] Ergebnis wird geloggt

### 3. Geoapify-Adressvalidierung

**Was:** Jede importierte Lieferadresse wird geprüft und korrigiert.

**Ablauf:**
1. Nach Adress-Sync: Adresse an Geoapify API schicken
2. Ergebnis speichern: `geoapify_validation_status`, `geoapify_lat`, etc.
3. Falls ungültig: Markieren für manuelle Prüfung

**Akzeptanzkriterien:**
- [ ] Adressen werden validiert
- [ ] Ergebnis wird in `partner_addresses` gespeichert
- [ ] Ungültige Adressen markiert
- [ ] Free-Tier Limits beachtet (3.000 Credits/Tag)

---

## Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| Easybill API-Limit erreicht | Mittel | Requests limitieren, Paginierung |
| Geoapify API-Limit erreicht | Niedrig | Requests zählen, bei Limit überspringen |
| Adresse ungültig/unklar | Mittel | Als 'invalid' markieren, manuell prüfen |
| Kunde in Easybill gelöscht | Niedrig | Als `is_archived = true` markieren, nicht löschen |
| Doppelte Kundennummer | Niedrig | UNIQUE constraint verhindert Duplikate |
| Webhook-Secret kompromittiert | Niedrig | IP-Whitelist + HTTPS + Token-Rotation |
| Dublette erkannt, aber falsch | Niedrig | Nur deaktivieren (nicht mergen), Admin prüft |
| Keine E-Mail bei Easybill-Kontakt | Mittel | Kunde wird abgelehnt + geloggt, manuelle Nacharbeit |

---

## Nächste Schritte

1. **Jan Bernd:** Diese aktualisierte Spec review + "approved"
2. **Klausi:** Architektur-Dokument erstellen
3. **Klausi:** Initial-Import der 67 Kunden
4. **Klausi:** Cronjob einrichten
5. **Klausi:** Geoapify implementieren
6. **Gemeinsam:** Test mit echten Daten

---

## Verwandte Projekte

- **PROJ-25:** Kunden-Rabatte aus Easybill importieren (neues Projekt)

---

*Letzte Änderung: 2026-07-10 08:24 UTC*
