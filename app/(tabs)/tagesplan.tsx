import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import * as Print from 'expo-print';
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

const NUM_ROWS = 24;
const NUM_COLS = 5;
const KATHETER_ROW_INDEX = 15;
const NOTARZT_ROW_INDEX = 14; // Notarzt row index
const KATHETER_ROW_COLS = 10;

// Helper: column count per row
function getColumnCount(rowIdx: number): number {
  return rowIdx === KATHETER_ROW_INDEX ? KATHETER_ROW_COLS : NUM_COLS;
}

// Helper: create empty table with variable column counts
function createEmptyTable(): string[][] {
  return Array.from({ length: NUM_ROWS }, (_, r) => Array(getColumnCount(r)).fill(""));
}

// Helper: normalize arbitrary raw data into our shape (length NUM_ROWS and per-row column counts)
function normalizeTableData(raw: unknown): string[][] {
  const result: string[][] = [];
  const asArr = Array.isArray(raw) ? raw : [];
  for (let r = 0; r < NUM_ROWS; r++) {
    const targetCols = getColumnCount(r);
    const row = Array.isArray(asArr[r]) ? asArr[r] : [];
    const normalized: string[] = [];
    for (let c = 0; c < targetCols; c++) {
      const val = row[c];
      normalized.push(typeof val === 'string' ? val : '');
    }
    result.push(normalized);
  }
  return result;
}

const firstColumnEntries = [
  "OP-Oberarzt",
  "Saal 1",
  "Saal 2",
  "Saal 3",
  "Saal 4",
  "Saal 5",
  "Saal 6",
  "Saal 7",
  "Saal 8",
  "Saal 9",
  "URES / TUR",
  "Herzkateter / Endo",
  "AWR / NFA / 1111",
  "Anäst. Sprechstunde",
  "Notarzt",
  "Katheter u. Sprechstunde",
  "ITS OA / OÄ",
  "ITS Regeldienst",
  "ITS Bereitschaft",
  "IMC",
  "Anäst. Bereitschaft",
  "Anäst. Hintergrund",
  "18 Uhr Dienst",
  "Anäst. Spätdienst"
];

const supabase = createClient('https://ykvrubvoohhoqbsyzdva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdnJ1YnZvb2hob3Fic3l6ZHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2OTE3MjcsImV4cCI6MjA3MzI2NzcyN30.q4Pp7L-HP2g-tPuhcjuKRaJhnRvgMnbu7KpcArqGfuw');

export default function EditTableScreen() {
  const today = new Date();
  // Schätze die Tabellenhöhe (z.B. 24px pro Zeile + Header)
  const rowHeight = 40;
  const headerHeight = 40;
  const estimatedTableHeight = NUM_ROWS * rowHeight + headerHeight;
  // Hilfsfunktion: KW-Id für Supabase
  function getSupabaseIdForWeek(monday: Date) {
    const year = monday.getFullYear();
    const week = getWeekNumber(monday);
    return year * 100 + week;
  }

  // Tabelleninhalt für aktuelle KW speichern - nur bei echten Änderungen
  async function saveTableForCurrentWeek() {
    const id = getSupabaseIdForWeek(monday);
    
    // Vergleiche aktuelle Tabelle mit zuletzt gespeicherter Version
    if (JSON.stringify(table) === JSON.stringify(lastSavedTableRef.current)) {
      // Keine Änderung - nicht speichern und Zeitstempel nicht aktualisieren
      console.log('Keine Änderung erkannt - Speichern übersprungen');
      return;
    }
    
    // Echte Änderung gefunden - speichern mit neuem Zeitstempel
    const now = new Date();
    await supabase
      .from('tagesplan')
      .upsert({ id, inhalt: table, updated_at: now.toISOString() })
      .then(({ error }) => {
        if (error) {
          console.log('Supabase Fehler beim Speichern:', error);
        } else {
          // Aktualisiere die Referenz für zukünftige Vergleiche
          lastSavedTableRef.current = JSON.parse(JSON.stringify(table));
          setLastModified(now);
          console.log('Echte Änderung gespeichert:', now);
        }
      });
  }

  // Tabelleninhalt für neue KW laden
  async function loadTableForWeek(newMonday: Date) {
    const id = getSupabaseIdForWeek(newMonday);
    const { data, error } = await supabase
      .from('tagesplan')
      .select('inhalt, updated_at')
      .eq('id', id)
      .single();
    if (data && data.inhalt) {
      const normalized = normalizeTableData(data.inhalt);
      setTable(normalized);
      // Aktualisiere die Referenz für Vergleiche
      lastSavedTableRef.current = JSON.parse(JSON.stringify(normalized));
      // Set timestamp from database if available
      if (data.updated_at) {
        setLastModified(new Date(data.updated_at));
      } else {
        setLastModified(null);
      }
    } else {
      const emptyTable = createEmptyTable();
      setTable(emptyTable);
      // Aktualisiere die Referenz für leere Tabelle
      lastSavedTableRef.current = JSON.parse(JSON.stringify(emptyTable));
      // For empty tables, don't set any timestamp
      setLastModified(null);
    }
    if (error) console.log('Supabase Ladefehler:', error);
  }
  // Hilfsfunktionen für KW und Datum
  function getFriday(monday: Date) {
    const d = new Date(monday);
    d.setDate(d.getDate() + 4);
    return d;
  }
  // Berechne Offset zur aktuellen KW (Differenz zwischen aktueller KW und KW des Startdatums)
  const startMonday = getMonday(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const startWeek = getWeekNumber(startMonday);
  const currentYear = today.getFullYear();
  const initialOffset = 0; // Standardmäßig 0, wird im useEffect gesetzt
  const [weekOffset, setWeekOffset] = useState(initialOffset);
  
  // Gerätetyp-Erkennung
  function getDeviceInfo() {
    const { width, height } = useWindowDimensions();
    
    return {
      // Platform-basierte Erkennung
      isWeb: Platform.OS === 'web',
      isIOS: Platform.OS === 'ios',
      isAndroid: Platform.OS === 'android',
      platform: Platform.OS,
      
      // Bildschirmgröße-basierte Erkennung
      isMobile: width < 768, // Weniger als Tablet-Breite
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      
      // Orientierung
      isPortrait: height > width,
      isLandscape: width > height,
      
      // Spezifische Werte
      screenWidth: width,
      screenHeight: height,
      
      // Kombinierte Logik für mobile Geräte
      isMobileDevice: Platform.OS === 'ios' || Platform.OS === 'android' || width < 768
    };
  }
  
  // Mobile Layout-Optimierung
  function getMobileLayoutDimensions() {
    const deviceInfo = getDeviceInfo();
    const { width, height } = useWindowDimensions();
    
    if (deviceInfo.isMobileDevice) {
      // Für mobile Geräte: Bildschirmbreite minus Padding verwenden
      const totalWidth = width - 16; // 8px padding links + rechts
      const firstColumnWidth = Math.floor(totalWidth * 0.3); // 30% für erste Spalte
      const remainingWidth = totalWidth - firstColumnWidth;
      const regularColumnWidth = Math.floor(remainingWidth / 5); // 5 Wochentage
      
      return {
        tableWidth: totalWidth,
        firstColumnWidth,
        regularColumnWidth,
        maxTableHeight: height - 180, // Optimiert für mobile Header/Footer
        isMobile: true
      };
    }
    
    // Desktop/Standard Layout
    return {
      tableWidth: 700,
      firstColumnWidth: 160,
      regularColumnWidth: 110,
      maxTableHeight: height - 250,
      isMobile: false
    };
  }
  
  const deviceInfo = getDeviceInfo();
  const layoutDimensions = getMobileLayoutDimensions();
  
  // Hilfsfunktionen für KW und Datum
  function getWeekNumber(date: Date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return weekNumber;
  }
  function getMonday(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
  // Berechne Montag und Freitag der aktuellen/verschobenen KW
  const monday = getMonday(new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7));
  const friday = getFriday(monday);
  const currentWeek = getWeekNumber(monday);
  const weekId = getSupabaseIdForWeek(monday);
  const dateString = `${monday.toLocaleDateString('de-DE')} - ${friday.toLocaleDateString('de-DE')}`;
  const { height: screenHeight } = useWindowDimensions();
  // Tabelleninhalt als eigene Funktion
  function renderTable() {
    return table.map((row, rowIdx) => {
      const isKatheterRow = rowIdx === KATHETER_ROW_INDEX;
      const isNotarztRow = rowIdx === NOTARZT_ROW_INDEX; // Define Notarzt row index
      const cellsToRender = getColumnCount(rowIdx);

      return (
        <View key={rowIdx} style={[styles.row, { justifyContent: "center", alignItems: "center" }]}> 
          {/* Erste Spalte: nicht editierbar */}
          <Text style={[styles.cell, styles.firstColCell, {
            minWidth: layoutDimensions.firstColumnWidth,
            maxWidth: layoutDimensions.firstColumnWidth,
            fontSize: layoutDimensions.isMobile ? 10 : 14
          }]}>
            {firstColumnEntries[rowIdx] || ""}
          </Text>
          {/* Editierbare Zellen */}
          {Array.from({ length: cellsToRender }, (_, colIdx) => {
            const cellValue = row[colIdx] || '';
            const isGrayedOut = isNotarztRow && [0, 1, 3, 4].includes(colIdx); // Gray out specific cells

            return (
              <View key={colIdx} style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.cell, 
                    !canEdit && styles.disabledCell,
                    isKatheterRow && layoutDimensions.isMobile ? 
                      { minWidth: Math.floor(layoutDimensions.regularColumnWidth * 0.5), maxWidth: Math.floor(layoutDimensions.regularColumnWidth * 0.5) } :
                      isKatheterRow ? { minWidth: 55, maxWidth: 55 } : {
                        minWidth: layoutDimensions.regularColumnWidth,
                        maxWidth: layoutDimensions.regularColumnWidth
                      },
                    isGrayedOut && styles.grayedOutCell, // Apply gray-out style
                    layoutDimensions.isMobile && { fontSize: 10, paddingHorizontal: 2, paddingVertical: 4 }
                  ]}
                  value={cellValue}
                  editable={canEdit && !isGrayedOut} // Disable editing for grayed-out cells
                  selectTextOnFocus={true}
                  onChangeText={(value) => handleCellChange(rowIdx, colIdx, value)}
                  onEndEditing={() => {
                    handleCellValidate(rowIdx, colIdx);
                  }}
                  onBlur={() => handleCellValidate(rowIdx, colIdx)}
                  onSubmitEditing={() => {
                    handleCellValidate(rowIdx, colIdx);
                    // Spezielle Navigation für bestimmte Zeilen
                    if (canEdit) {
                      // Spezielle Navigation für "Anästhesie Sprechstunde" (Index 13)
                      if (rowIdx === 13) {
                        // Für Montag (colIdx 0): springe zum ersten Katheter-Feld
                        if (colIdx === 0) {
                          const nextInputRef = inputRefs[15]?.[0]; // Erstes Katheter-Feld (Montag)
                          nextInputRef?.focus();
                        }
                        // Für Dienstag (colIdx 1): springe zum dritten Katheter-Feld
                        else if (colIdx === 1) {
                          const nextInputRef = inputRefs[15]?.[2]; // Drittes Katheter-Feld (Mittwoch)
                          nextInputRef?.focus();
                        }
                        // Für Mittwoch (colIdx 2): springe zum Notarzt-Feld
                        else if (colIdx === 2) {
                          const nextInputRef = inputRefs[14]?.[2]; // Notarzt Mittwoch
                          nextInputRef?.focus();
                        }
                        // Für Donnerstag (colIdx 3): springe zum siebten Katheter-Feld
                        else if (colIdx === 3) {
                          const nextInputRef = inputRefs[15]?.[6]; // Siebtes Katheter-Feld (Index 6)
                          nextInputRef?.focus();
                        }
                        // Für Freitag (colIdx 4): springe zum neunten Katheter-Feld
                        else if (colIdx === 4) {
                          const nextInputRef = inputRefs[15]?.[8]; // Neuntes Katheter-Feld (Index 8)
                          nextInputRef?.focus();
                        }
                        // Für andere Tage: springe zum entsprechenden Katheter-Feld
                        else {
                          const nextInputRef = inputRefs[15]?.[colIdx]; // Entsprechendes Katheter-Feld
                          nextInputRef?.focus();
                        }
                      }
                      // Navigation von Notarzt (Index 14) zu Katheter u. Sprechstunde (Index 15)
                      else if (rowIdx === 14) {
                        // Für Mittwoch (colIdx 2): springe zum fünften Katheter-Feld
                        if (colIdx === 2) {
                          const nextInputRef = inputRefs[15]?.[4]; // Fünftes Katheter-Feld (Index 4)
                          nextInputRef?.focus();
                        }
                        // Für alle anderen Tage: standard Navigation zu entsprechendem Katheter-Feld
                        else {
                          const nextInputRef = inputRefs[15]?.[colIdx];
                          nextInputRef?.focus();
                        }
                      }
                      // Spezielle Navigation für Katheter u. Sprechstunde (Index 15)
                      else if (rowIdx === 15) {
                        // Für Montag (colIdx 0): vom ersten Katheter-Feld zum zweiten
                        if (colIdx === 0) {
                          const nextInputRef = inputRefs[15]?.[1]; // Zweites Katheter-Feld (Dienstag)
                          nextInputRef?.focus();
                        }
                        // Für Dienstag (colIdx 1): vom zweiten Katheter-Feld zu ITS OA Montag
                        else if (colIdx === 1) {
                          const nextInputRef = inputRefs[16]?.[0]; // ITS OA Montag
                          nextInputRef?.focus();
                        }
                        // Für Mittwoch (colIdx 2): vom dritten Katheter-Feld zum vierten
                        else if (colIdx === 2) {
                          const nextInputRef = inputRefs[15]?.[3]; // Viertes Katheter-Feld (Donnerstag)
                          nextInputRef?.focus();
                        }
                        // Für Donnerstag (colIdx 3): vom vierten Katheter-Feld zu ITS OA Dienstag
                        else if (colIdx === 3) {
                          const nextInputRef = inputRefs[16]?.[1]; // ITS OA Dienstag
                          nextInputRef?.focus();
                        }
                        // Für Freitag (colIdx 4): vom fünften Katheter-Feld zu ITS OA entsprechend
                        else if (colIdx === 4) {
                          const nextInputRef = inputRefs[15]?.[5]; // Sechstes Katheter-Feld (Index 5)
                          nextInputRef?.focus();
                        }
                        // Für Katheter-Feld 6 (colIdx 5): vom sechsten Katheter-Feld zu ITS OA Mittwoch
                        else if (colIdx === 5) {
                          const nextInputRef = inputRefs[16]?.[2]; // ITS OA Mittwoch
                          nextInputRef?.focus();
                        }
                        // Für Katheter-Feld 7 (colIdx 6): vom siebten zum achten Katheter-Feld
                        else if (colIdx === 6) {
                          const nextInputRef = inputRefs[15]?.[7]; // Achtes Katheter-Feld (Index 7)
                          nextInputRef?.focus();
                        }
                        // Für Katheter-Feld 8 (colIdx 7): vom achten Katheter-Feld zu ITS OA Donnerstag
                        else if (colIdx === 7) {
                          const nextInputRef = inputRefs[16]?.[3]; // ITS OA Donnerstag
                          nextInputRef?.focus();
                        }
                        // Für Katheter-Feld 9 (colIdx 8): vom neunten zum zehnten Katheter-Feld
                        else if (colIdx === 8) {
                          const nextInputRef = inputRefs[15]?.[9]; // Zehntes Katheter-Feld (Index 9)
                          nextInputRef?.focus();
                        }
                        // Für Katheter-Feld 10 (colIdx 9): vom zehnten Katheter-Feld zu ITS OA Freitag
                        else if (colIdx === 9) {
                          const nextInputRef = inputRefs[16]?.[4]; // ITS OA Freitag
                          nextInputRef?.focus();
                        }
                        // Für weitere Spalten (falls vorhanden): standard Navigation zu ITS OA
                        else {
                          const nextInputRef = inputRefs[16]?.[colIdx];
                          nextInputRef?.focus();
                        }
                      }
                      // Standard-Navigation für alle anderen Zeilen
                      else {
                        const nextRow = rowIdx + 1;
                        if (nextRow < NUM_ROWS) {
                          // Gehe zur nächsten Zelle nach unten in derselben Spalte
                          const nextInputRef = inputRefs[nextRow]?.[colIdx];
                          nextInputRef?.focus();
                        } else {
                          // Letzte Zelle der Spalte erreicht - gehe zur ersten Zeile der nächsten Spalte
                          const maxCols = getColumnCount(0);
                          const nextCol = colIdx + 1;
                          if (nextCol < maxCols) {
                            const nextInputRef = inputRefs[0]?.[nextCol];
                            nextInputRef?.focus();
                          } else {
                            const nextInputRef = inputRefs[0]?.[0];
                            nextInputRef?.focus();
                          }
                        }
                      }
                    }
                  }}
                  ref={ref => {
                    if (!inputRefs[rowIdx]) inputRefs[rowIdx] = [];
                    inputRefs[rowIdx][colIdx] = ref;
                  }}
                  blurOnSubmit={false}
                />
              </View>
            );
          })}
        </View>
      );
    });
  }
  const [table, setTable] = useState<string[][]>(createEmptyTable());
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastModified, setLastModified] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);
  const suppressSaveRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tableRef = useRef(table);
  const lastSavedTableRef = useRef<string[][]>(createEmptyTable());

  // Daten beim Start laden
  useEffect(() => {
    // Setze Offset beim ersten Render auf die aktuelle KW
    if (weekOffset === 0) {
      const now = new Date();
      const thisMonday = getMonday(now);
      const thisWeek = getWeekNumber(thisMonday);
      const thisYear = now.getFullYear();
      // Berechne Offset zur aktuellen KW
      const offset = (thisYear - currentYear) * 52 + (thisWeek - startWeek);
      if (offset !== 0) setWeekOffset(offset);
    }
    // Lade initial die aktuelle KW
    loadTableForWeek(monday);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // Countdown-Logik
  useEffect(() => {
    if (canEdit && countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    if (countdown === 0 && canEdit) {
      setCanEdit(false);
      setShowPassword(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown, canEdit]);

  // Zellenwert ändern
  const handleCellChange = async (rowIdx: number, colIdx: number, value: string) => {
    if (!canEdit) return;
    
    const newTable = table.map((row, r) =>
      row.map((cell, c) => (r === rowIdx && c === colIdx ? value : cell))
    );
    setTable(newTable);
    setCountdown(120); // Countdown nach jedem Tastendruck neu starten
  };

  // Fehler bei identischem Wert in Spalte
  const handleCellValidate = (rowIdx: number, colIdx: number) => {
    if (!canEdit) return;
    
    // Überprüfung NUR für Saal 1 bis AWR / NFA / 1111 (Zeilen 1-12)
    const checkRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (!checkRows.includes(rowIdx)) return;
    
    // Schutz: falls Spalte in manchen Zeilen nicht existiert (variable Breite)
    const value = table[rowIdx]?.[colIdx] ?? '';
    // Vergleiche nur innerhalb der erlaubten Zeilen (Saal 1 .. AWR)
    const columnValues = table.map((r, idx) => (idx !== rowIdx && checkRows.includes(idx)) ? (r[colIdx] ?? null) : null);
    if (value !== "" && columnValues.includes(value)) {
      const newTable = table.map((r, rIdx2) =>
        r.map((c, cIdx2) =>
          rIdx2 === rowIdx && cIdx2 === colIdx ? "FEHLER" : c
        )
      );
      setTable(newTable);
    }
  };

  // Eingabe-Button
  // Eingabe-Button entfällt

  // Passwort prüfen
  const handlePasswordSubmit = () => {
    if (password === "chef") {
      setCanEdit(true);
      setCountdown(120); // Countdown startet nur nach Login
      setShowPassword(false);
      setPassword(""); // Passwortfeld leeren
    } else {
      setPassword("");
    }
  };

  // Tabelle löschen
  const clearTable = () => {
    if (!canEdit) return;
    setTable(createEmptyTable());
  };

  // Funktion zum Drucken der Tabelle
  const printTable = async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="color-scheme" content="light only" />
          <style>
            @page { size: auto; margin: 12mm; }
            html, body { background: #ffffff; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #000000;
              margin: 0;
              padding: 0 12mm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            h1 {
              text-align: center;
              font-size: 18px;
              margin: 8px 0 6px;
              color: #000;
            }
            h2 {
              text-align: center;
              font-size: 14px;
              margin: 0 0 12px;
              font-weight: normal;
              color: #000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              font-size: 11px;
              margin: 0 auto;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #333;
              padding: 4px;
              text-align: center;
              vertical-align: middle;
              color: #000;
            }
            th {
              background: #e0e0e0;
              font-weight: bold;
            }
            td:first-child, th:first-child {
              background: #f0f0f0;
              font-weight: bold;
              text-align: left;
              width: 150px;
              max-width: 150px;
            }
            /* Katheter row: 2 side-by-side entries per day cell (5 day cells x 2 = 10) */
            .katheter-pair-td { padding: 4px; background: #ffffff; }
            .katheter-pair { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .katheter-pair td {
              width: 50%;
              background: #ffffff;
              font-weight: normal;
              text-align: center;
              font-size: 11px;
              padding: 0; /* outer cell provides standard padding so row height matches others */
              line-height: 1.2;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              vertical-align: middle;
              border: none; /* Remove all borders from inner Katheter cells */
            }
            .notarzt-row .grayed-out {
              background-color: #f0f0f0;
              color: #888;
              text-decoration: line-through;
            }
          </style>
        </head>
        <body>
          <h1>Tagesplan Anästhesie und Intensivstation SLF</h1>
          <h2>KW ${currentWeek}, ${dateString}</h2>
          <table>
            <colgroup>
              <col class="col-first" style="width:150px" />
              <col class="col-day" span="5" />
            </colgroup>
            <thead>
              <tr>
                <th>Dienst</th>
                <th>Montag</th>
                <th>Dienstag</th>
                <th>Mittwoch</th>
                <th>Donnerstag</th>
                <th>Freitag</th>
              </tr>
            </thead>
            <tbody>
              ${table.map((row, rowIdx) => {
                const isKatheterRow = rowIdx === KATHETER_ROW_INDEX;
                const isNotarztRow = rowIdx === NOTARZT_ROW_INDEX;
                let cellsHtml = '';
                
                if (isKatheterRow) {
                  // Group 10 entries into 5 day cells, each with 2 stacked rows
                  const padded = [...row];
                  const padCount = KATHETER_ROW_COLS - padded.length;
                  for (let i = 0; i < padCount; i++) padded.push('');
                  const dayCells = Array.from({ length: NUM_COLS }, (_, d) => {
                    const left = padded[2 * d] || '';
                    const right = padded[2 * d + 1] || '';
                    return `<td class="katheter-pair-td"><table class="katheter-pair"><tr><td>${left}</td><td>${right}</td></tr></table></td>`;
                  }).join('');
                  cellsHtml = dayCells;
                } else {
                  cellsHtml = row.map((cell, colIdx) => {
                    const isGrayedOut = isNotarztRow && [0, 1, 3, 4].includes(colIdx);
                    return `<td class="${isGrayedOut ? 'grayed-out' : ''}">${cell || ''}</td>`;
                  }).join('');
                  // Pad standard rows to exactly the 5 day columns if shorter
                  const padCount = NUM_COLS - row.length;
                  if (padCount > 0) {
                    cellsHtml += '<td></td>'.repeat(padCount);
                  }
                }

                return `
                  <tr class="${isKatheterRow ? 'katheter-row' : ''} ${isNotarztRow ? 'notarzt-row' : ''}">
                    <td>${firstColumnEntries[rowIdx] || ""}</td>
                    ${cellsHtml}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ${lastModified ? `
          <div style="text-align: center; margin-top: 16px; font-size: 14px; color: #666;">
            Letzte Änderung: ${lastModified.toLocaleDateString('de-DE')} ${lastModified.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
          ` : ''}
        </body>
      </html>
    `;
    // On web, open a new window and trigger native printing for consistent output
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        // Ensure styles render before printing
        win.focus();
        // Some browsers need a short delay for layout
        setTimeout(() => {
          try {
            win.print();
          } catch (e) {
            // ignore
          }
          // Close the window after printing (best effort)
          try { win.close(); } catch {}
        }, 150);
        return;
      }
    }
    // Fallback to expo-print (native/mobile or if popup blocked)
    await Print.printAsync({ html });
  };

  const inputRefs: Array<Array<TextInput | null>> = Array(NUM_ROWS).fill(null).map(() => []);

  // Beim Wechsel von bearbeitbar -> gesperrt (Logout/Timer) einmalig speichern
  const prevCanEditRef = useRef(canEdit);
  useEffect(() => {
    const prev = prevCanEditRef.current;
    prevCanEditRef.current = canEdit;
    if (prev && !canEdit) {
      saveTableForCurrentWeek();
    }
  }, [canEdit]);

  // Autosave während Bearbeitung (debounced)
  useEffect(() => {
    if (!canEdit) return;
    if (suppressSaveRef.current) return;
    const t = setTimeout(() => {
      saveTableForCurrentWeek();
    }, 800);
    return () => clearTimeout(t);
  }, [table, canEdit]);

  // Realtime-Sync: Änderungen der aktuellen Woche live übernehmen
  useEffect(() => {
    // Vorherige Subscription aufräumen
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`tagesplan:${weekId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tagesplan', filter: `id=eq.${weekId}` },
        (payload: any) => {
          const next = payload?.new?.inhalt;
          const nextUpdatedAt = payload?.new?.updated_at;
          if (next) {
            // verhindert Autosave-Schleifen
            suppressSaveRef.current = true;
            setTable(normalizeTableData(next));
            // Update lastModified from realtime data if available
            if (nextUpdatedAt) {
              setLastModified(new Date(nextUpdatedAt));
            }
            setTimeout(() => { suppressSaveRef.current = false; }, 1000);
          }
        }
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [weekId]);

  // Halte tableRef synchron mit aktuellem Tabellenzustand
  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  // Polling-Fallback: wenn nicht bearbeitet wird, alle 8s auf Änderungen prüfen
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        if (canEdit) return; // beim Editieren nicht überschreiben
        if (suppressSaveRef.current) return; // wenn gerade Realtime angewendet wurde

        const id = getSupabaseIdForWeek(monday);
        const { data, error } = await supabase
          .from('tagesplan')
          .select('inhalt, updated_at')
          .eq('id', id)
          .single();

        if (error) {
          console.log('Supabase Pollingfehler:', error);
          return;
        }

        const remote = data?.inhalt as string[][] | undefined;
        if (!remote) return;

        const normalized = normalizeTableData(remote);
        const local = tableRef.current;
        if (JSON.stringify(normalized) !== JSON.stringify(local)) {
          suppressSaveRef.current = true;
          setTable(normalizeTableData(remote));
          // Update lastModified from polling data if available
          if (data.updated_at) {
            setLastModified(new Date(data.updated_at));
          }
          setTimeout(() => { suppressSaveRef.current = false; }, 1000);
        }
      } catch (e) {
        // optional: stilles Logging
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [monday, canEdit]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.fullContainerCentered, layoutDimensions.isMobile && { paddingHorizontal: 0 }]}>
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Text style={styles.headerCentered}>
            Tagesplan Anästhesie und Intensivstation SLF
          </Text>
          <View {...(typeof document !== 'undefined' ? ({ className: 'print-hide' } as any) : {})} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingHorizontal: layoutDimensions.isMobile ? 8 : 0 }}>
            <View style={{ marginRight: 8 }}>
              <Button title="<" onPress={async () => {
                await saveTableForCurrentWeek();
                setWeekOffset(weekOffset - 1);
              }} />
            </View>
            <Text style={{ fontSize: layoutDimensions.isMobile ? 14 : 16, fontWeight: 'bold', textAlign: 'center', minWidth: layoutDimensions.isMobile ? 'auto' : 220 }}>
              KW {currentWeek}, {dateString}
            </Text>
            <View style={{ marginLeft: 8 }}>
              <Button title=">" onPress={async () => {
                await saveTableForCurrentWeek();
                setWeekOffset(weekOffset + 1);
              }} />
            </View>
          </View>
        </View>
        <View {...(typeof document !== 'undefined' ? ({ className: 'print-hide' } as any) : {})} style={[styles.buttonRowCentered, { paddingHorizontal: layoutDimensions.isMobile ? 8 : 0 }]}>
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%", flexWrap: 'wrap' }}>
            <Button title="Drucken" onPress={printTable} />
            <View style={{ width: layoutDimensions.isMobile ? 8 : 16 }} />
            <View style={[styles.passwordBoxCentered, { alignItems: "center" }]}>
              <Text style={{ marginRight: layoutDimensions.isMobile ? 4 : 8 }}>Passwort:</Text>
              <TextInput
                  style={[styles.passwordInputCentered, layoutDimensions.isMobile && { width: 60, marginHorizontal: 4 }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoFocus
                  autoComplete="off"
                  autoCorrect={false}
                  autoCapitalize="none"
                  textContentType="none"
                  passwordRules=""
                  onSubmitEditing={handlePasswordSubmit}
                  onKeyPress={e => {
                    if (e.nativeEvent.key === 'Enter') handlePasswordSubmit();
                  }}
              />
              <Button title="OK" onPress={handlePasswordSubmit} />
            </View>
            <View style={{ width: layoutDimensions.isMobile ? 8 : 16 }} />
            <Button title="Logout" onPress={() => setCanEdit(false)} disabled={!canEdit} />
          </View>
        </View>
        <View style={styles.tableWrapperCentered}>
          <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <ScrollView 
              horizontal={!layoutDimensions.isMobile} 
              style={{ maxWidth: '100%' }} 
              contentContainerStyle={{ 
                alignItems: 'center', 
                justifyContent: 'center', 
                minWidth: layoutDimensions.tableWidth 
              }}
              showsHorizontalScrollIndicator={false}
            >
              <View style={{ minWidth: layoutDimensions.tableWidth, alignItems: 'center', justifyContent: 'center' }}>
                {/* Tabellenkopf */}
                <View style={[styles.row, { justifyContent: 'center', alignItems: 'center' }] }>
                  <Text style={[styles.cell, styles.headerCell, styles.firstColHeader, { 
                    minWidth: layoutDimensions.firstColumnWidth, 
                    maxWidth: layoutDimensions.firstColumnWidth 
                  }]}>Dienst</Text>
                  {/* Standard 5 Spalten */}
                  { ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"].map((day, colIdx) => (
                    <Text
                      key={colIdx}
                      style={[styles.cell, styles.headerCell, { 
                        minWidth: layoutDimensions.regularColumnWidth, 
                        maxWidth: layoutDimensions.regularColumnWidth, 
                        textAlign: 'center',
                        fontSize: layoutDimensions.isMobile ? 12 : 14 
                      }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {day}
                    </Text>
                  ))}
                </View>
                {/* Tabelleninhalt mit vertikalem Slider */}
                <ScrollView 
                  style={{ 
                    maxHeight: layoutDimensions.maxTableHeight, 
                    width: layoutDimensions.tableWidth, 
                    alignSelf: 'center' 
                  }} 
                  contentContainerStyle={{ 
                    minWidth: layoutDimensions.tableWidth, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                  showsHorizontalScrollIndicator={false}
                >
                  {renderTable()}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>
  <View {...(typeof document !== 'undefined' ? ({ className: 'print-hide' } as any) : {})} style={[styles.countdownBoxCentered, { width: layoutDimensions.tableWidth }]}>
          {canEdit ? (
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={[styles.countdownTextCentered, layoutDimensions.isMobile && { fontSize: 12 }]}>Bearbeitungszeit: {countdown} Sekunden</Text>
              {/* Zeitstempel auch während Bearbeitung anzeigen */}
              <Text style={[styles.countdownTextCentered, { textAlign: "center", fontSize: layoutDimensions.isMobile ? 10 : 12, color: "#666", marginTop: 8 }]}>
                Letzte Änderung: {lastModified ? `${lastModified.toLocaleDateString('de-DE')} ${lastModified.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Noch nie gespeichert'}
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", width: "100%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <Text style={[styles.countdownTextCentered, { textAlign: "left", flex: 1, fontSize: layoutDimensions.isMobile ? 10 : 14 }]}>Fehlermeldung: M. Cercasov 3630</Text>
                {/* Zeitstempel in der Mitte */}
                <Text style={[styles.countdownTextCentered, { textAlign: "center", fontSize: layoutDimensions.isMobile ? 9 : 12, color: "#666", flex: 1 }]}>
                  Letzte Änderung: {lastModified ? `${lastModified.toLocaleDateString('de-DE')} ${lastModified.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Noch nie gespeichert'}
                </Text>
                <Text style={[styles.countdownTextCentered, { textAlign: "right", flex: 1, fontSize: layoutDimensions.isMobile ? 10 : 14 }]}>zum Bearbeiten einloggen</Text>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  fullContainerCentered: { flex: 1, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  headerCentered: { fontSize: 20, fontWeight: "bold", margin: 16, textAlign: "center", alignSelf: "center" },
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  cell: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 6,
    minWidth: 110,
    maxWidth: 110,
    textAlign: "center",
    backgroundColor: "#fff",
    flex: 1
  },
  disabledCell: {
    backgroundColor: "#eaeaea",
    color: "#888"
  },
  headerCell: {
    backgroundColor: "#e0e0e0",
    fontWeight: "bold"
  },
  firstColHeader: {
    minWidth: 160,
    maxWidth: 160,
    textAlign: "center",
    flex: 1
  },
  firstColCell: {
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    minWidth: 160,
    maxWidth: 160,
    textAlign: "center",
    flex: 1
  },
  buttonRowCentered: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 8,
    marginHorizontal: 16,
    alignSelf: "center",
    width: "100%"
  },
  passwordBoxCentered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center"
  },
  passwordInputCentered: {
  borderWidth: 1,
  borderColor: "#ccc",
  paddingVertical: 4,
  paddingHorizontal: 4,
  marginHorizontal: 8,
  width: 80,     // gewünschte Breite
  minWidth: 0,   // verhindert, dass minWidth blockiert
  backgroundColor: "#fff",
  textAlign: "center",
  alignSelf: "center",
  },
  tableWrapperCentered: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  countdownBoxCentered: {
    alignItems: "center",
    marginVertical: 8,
    alignSelf: "center"
  },
  countdownTextCentered: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    alignSelf: "center"
  },
  noPrint: {
    display: 'none',
  },
  grayedOutCell: {
    backgroundColor: "#f0f0f0",
    color: "#888",
    textDecorationLine: "line-through",
  }
});