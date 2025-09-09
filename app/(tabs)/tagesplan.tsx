import { Stack } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Print from 'expo-print';

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

export default function EditTableScreen() {
  const [table, setTable] = useState<string[][]>(
    Array.from({ length: NUM_ROWS }, () => Array(NUM_COLS).fill(''))
  );
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.fullContainerCentered}>
  <Text style={styles.headerCentered}>Tagesplan Anästhesie und Intensivstation SLF</Text>
      <View style={styles.buttonRowCentered}>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%" }}>
          <Button title="Tabelle löschen" onPress={clearTable} disabled={!canEdit} />
          <View style={{ width: 16 }} />
          <Button title="Tabelle drucken" onPress={printTable} />
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
        <ScrollView horizontal style={{ maxWidth: '100%' }} contentContainerStyle={{ alignItems: "center", justifyContent: "center" }}>
          <View style={{ minWidth: 700, alignItems: "center", justifyContent: "center" }}>
            {/* Tabellenkopf */}
            <View style={[styles.row, { justifyContent: "center", alignItems: "center" }] }>
              <Text style={[styles.cell, styles.headerCell, styles.firstColHeader]}>Dienst</Text>
              { ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"].map((day, colIdx) => (
                <Text
                  key={colIdx}
                  style={[styles.cell, styles.headerCell, { minWidth: 110, maxWidth: 110, textAlign: "center" }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {day}
                </Text>
              ))}
            </View>
            {/* Tabelleninhalt mit vertikalem Slider nur bei Bedarf */}
            <View style={{ maxHeight: '70vh', width: '100%' }}>
              <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: "center", justifyContent: "center" }}>
                {table.map((row, rowIdx) => (
                  <View key={rowIdx} style={[styles.row, { justifyContent: "center", alignItems: "center" }] }>
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
                ))}
              </ScrollView>
            </View>
          </View>
        </ScrollView>
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