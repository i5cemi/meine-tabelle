import { createClient } from '@supabase/supabase-js';
import * as Print from 'expo-print';
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

const NUM_ROWS = 23;
const NUM_COLS = 5;

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
  "Anästhesie Sprechstunde",
  "Notarzt",
  "Katheter u. Sprechstunde",
  "ITS OA / OÄ",
  "ITS Regeldienst",
  "ITS Bereitschaft",
  "IMC",
  "Anästhesie Bereitschaft",
  "Anästhesie Hintergrund",
  "18 Uhr Dienst",
  "Anästhesie Spätdienst"
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

  // Tabelleninhalt für aktuelle KW speichern
  async function saveTableForCurrentWeek() {
    const id = getSupabaseIdForWeek(monday);
    await supabase
      .from('tagesplan')
      .upsert({ id, inhalt: table })
      .then(({ error }) => {
        if (error) console.log('Supabase Fehler beim Speichern:', error);
      });
  }

  // Tabelleninhalt für neue KW laden
  async function loadTableForWeek(newMonday: Date) {
    const id = getSupabaseIdForWeek(newMonday);
    const { data, error } = await supabase
      .from('tagesplan')
      .select('inhalt')
      .eq('id', id)
      .single();
    if (data && data.inhalt) setTable(data.inhalt);
    else setTable(Array.from({ length: NUM_ROWS }, () => Array(NUM_COLS).fill('')));
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
  const dateString = `${monday.toLocaleDateString('de-DE')} - ${friday.toLocaleDateString('de-DE')}`;
  const { height: screenHeight } = useWindowDimensions();
  // Tabelleninhalt als eigene Funktion
  function renderTable() {
    return table.map((row, rowIdx) => (
      <View key={rowIdx} style={[styles.row, { justifyContent: "center", alignItems: "center" }]}> 
        {/* Erste Spalte: nicht editierbar */}
        <Text style={[styles.cell, styles.firstColCell]}>
          {firstColumnEntries[rowIdx] || ""}
        </Text>
        {/* Editierbare Zellen */}
        {row.map((cell, colIdx) => (
          <TextInput
            key={colIdx}
            style={[styles.cell, !canEdit && styles.disabledCell]}
            value={cell}
            editable={canEdit}
            onChangeText={(value) => handleCellChange(rowIdx, colIdx, value)}
            onEndEditing={() => handleCellValidate(rowIdx, colIdx)}
            onBlur={() => handleCellValidate(rowIdx, colIdx)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Tab') {
                handleCellValidate(rowIdx, colIdx);
              }
            }}
            onSubmitEditing={() => {
              handleCellValidate(rowIdx, colIdx);
              // Springe in die nächste Zelle
              if (canEdit) {
                const nextCol = colIdx + 1;
                const nextRow = rowIdx + (nextCol >= NUM_COLS ? 1 : 0);
                const nextColIdx = nextCol % NUM_COLS;
                if (nextRow < NUM_ROWS) {
                  const nextInputRef = inputRefs[nextRow]?.[nextColIdx];
                  nextInputRef?.focus();
                }
              }
            }}
            ref={ref => {
              if (!inputRefs[rowIdx]) inputRefs[rowIdx] = [];
              inputRefs[rowIdx][colIdx] = ref;
            }}
            blurOnSubmit={false}
          />
        ))}
      </View>
    ));
  }
  const [table, setTable] = useState<string[][]>(
    Array.from({ length: NUM_ROWS }, () => Array(NUM_COLS).fill(''))
  );
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<number | null>(null);

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
  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    if (!canEdit) return;
    const newTable = table.map((row, r) =>
      row.map((cell, c) => (r === rowIdx && c === colIdx ? value : cell))
    );
    setTable(newTable);
    setCountdown(15); // Countdown nach jedem Tastendruck neu starten
  };

  // Fehler bei identischem Wert in Spalte
  const handleCellValidate = (rowIdx: number, colIdx: number) => {
    if (!canEdit) return;
    const value = table[rowIdx][colIdx];
    const columnValues = table.map((r, idx) => idx !== rowIdx ? r[colIdx] : null);
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
      setCountdown(20); // Countdown startet nur nach Login
      setShowPassword(false);
      setPassword(""); // Passwortfeld leeren
    } else {
      setPassword("");
    }
  };

  // Tabelle löschen
  const clearTable = () => {
    if (!canEdit) return;
    setTable(Array.from({ length: NUM_ROWS }, () => Array(NUM_COLS).fill('')));
  };

  // Funktion zum Drucken der Tabelle
  const printTable = async () => {
    const html = `
      <html>
        <head>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #333; padding: 4px; text-align: center; }
            th { background: #e0e0e0; }
            td:first-child, th:first-child { background: #f0f0f0; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Tagesplan Anästhesie und Intensivstation SLF</h2>
          <table>
            <tr>
              <th>Dienst</th>
              <th>Montag</th>
              <th>Dienstag</th>
              <th>Mittwoch</th>
              <th>Donnerstag</th>
              <th>Freitag</th>
            </tr>
            ${table.map((row, rowIdx) => `
              <tr>
                <td>${firstColumnEntries[rowIdx] || ""}</td>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </table>
        </body>
      </html>
    `;
    await Print.printAsync({ html });
  };

  const inputRefs: Array<Array<TextInput | null>> = Array(NUM_ROWS).fill(null).map(() => []);

  // Daten nach Ausloggen speichern
  useEffect(() => {
    if (!canEdit) {
      supabase
        .from('tagesplan')
        .upsert({ id: 1, inhalt: table })
        .then(({ error }) => {
          if (error) console.log('Supabase Fehler:', error);
        });
    }
  }, [canEdit, table]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.fullContainerCentered}>
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Text style={styles.headerCentered}>
            Tagesplan Anästhesie und Intensivstation SLF
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <View style={{ marginRight: 8 }}>
              <Button title="<" onPress={async () => {
                await saveTableForCurrentWeek();
                setWeekOffset(weekOffset - 1);
              }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', minWidth: 220 }}>
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
      <View style={styles.buttonRowCentered}>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%" }}>
          <Button title="Tabelle löschen" onPress={clearTable} disabled={!canEdit} />
          <View style={{ width: 16 }} />
          <Button title="Tabelle drucken" onPress={printTable} />
          <View style={{ width: 16 }} />
          <Button title="Logout" onPress={() => setCanEdit(false)} disabled={!canEdit} />
          <View style={{ width: 16 }} />
          <View style={styles.passwordBoxCentered}>
            <Text>Passwort:</Text>
            <TextInput
              style={styles.passwordInputCentered}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
              onSubmitEditing={handlePasswordSubmit}
            />
            <Button title="OK" onPress={handlePasswordSubmit} />
          </View>
        </View>
      </View>
      <View style={styles.tableWrapperCentered}>
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <ScrollView horizontal style={{ maxWidth: '100%' }} contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minWidth: 700 }}>
            <View style={{ minWidth: 700, alignItems: 'center', justifyContent: 'center' }}>
              {/* Tabellenkopf */}
              <View style={[styles.row, { justifyContent: 'center', alignItems: 'center' }] }>
                <Text style={[styles.cell, styles.headerCell, styles.firstColHeader]}>Dienst</Text>
                { ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"].map((day, colIdx) => (
                  <Text
                    key={colIdx}
                    style={[styles.cell, styles.headerCell, { minWidth: 110, maxWidth: 110, textAlign: 'center' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {day}
                  </Text>
                ))}
              </View>
              {/* Tabelleninhalt mit vertikalem Slider */}
              <ScrollView style={{ maxHeight: screenHeight - 250, width: 700, alignSelf: 'center' }} contentContainerStyle={{ minWidth: 700, alignItems: 'center', justifyContent: 'center' }}>
                {renderTable()}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>
      <View style={styles.countdownBoxCentered}>
        {canEdit ? (
          <Text style={styles.countdownTextCentered}>Bearbeitungszeit: {countdown} Sekunden</Text>
        ) : (
          <Text style={styles.countdownTextCentered}>Bearbeitung gesperrt. Bitte erneut einloggen.</Text>
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
    marginBottom: 12,
    gap: 8,
    alignSelf: "center"
  },
  passwordInputCentered: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 6,
    marginHorizontal: 8,
    minWidth: 100,
    backgroundColor: "#fff",
    textAlign: "center",
    alignSelf: "center"
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
  }
});