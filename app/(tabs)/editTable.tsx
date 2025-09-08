import React, { useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  // Initialisiere die Tabelle mit leeren Strings
  const [table, setTable] = useState<string[][]>(
    Array.from({ length: NUM_ROWS }, () => Array(NUM_COLS).fill(''))
  );

  // Zellenwert ändern
  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const newTable = table.map((row, r) =>
      row.map((cell, c) => (r === rowIdx && c === colIdx ? value : cell))
    );
    setTable(newTable);
  };

  // Tabelle löschen
  const clearTable = () => {
    setTable(Array.from({ length: NUM_ROWS }, () => Array(NUM_COLS).fill('')));
  };

  const inputRefs: Array<Array<TextInput | null>> = Array(NUM_ROWS).fill(null).map(() => []);

  return (
    <SafeAreaView style={styles.fullContainer}>
      <Text style={styles.header}>Tagesplan Anästhesie und Intensivstation SLF</Text>
      <Button title="Tabelle löschen" onPress={clearTable} />
      <ScrollView horizontal style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Tabellenkopf */}
          <View style={styles.row}>
            <Text style={[styles.cell, styles.headerCell, styles.firstColHeader]}>Dienst</Text>
            {["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"].map((day, colIdx) => (
              <Text
                key={colIdx}
                style={[styles.cell, styles.headerCell, { minWidth: 90, textAlign: "center" }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {day}
              </Text>
            ))}
          </View>
          {/* Tabelleninhalt */}
          <ScrollView style={{ flex: 1 }}>
            {table.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {/* Erste Spalte: nicht editierbar */}
                <Text style={[styles.cell, styles.firstColCell]}>
                  {firstColumnEntries[rowIdx] || ""}
                </Text>
                {/* Editierbare Zellen */}
                {row.map((cell, colIdx) => (
                  <TextInput
                    key={colIdx}
                    style={styles.cell}
                    value={cell}
                    onChangeText={(value) => handleCellChange(rowIdx, colIdx, value)}
                    onEndEditing={() => {
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
                    }}
                    onSubmitEditing={() => {
                      const value = table[rowIdx][colIdx];
                      const columnValues = table.map((r, idx) => idx !== rowIdx ? r[colIdx] : null);
                      if (value !== "" && columnValues.includes(value)) {
                        const newTable = table.map((r, rIdx2) =>
                          r.map((c, cIdx2) =>
                            rIdx2 === rowIdx && cIdx2 === colIdx ? "FEHLER" : c
                          )
                        );
                        setTable(newTable);
                        return;
                      }
                      // Springe in die nächste Zelle
                      const nextCol = colIdx + 1;
                      const nextRow = rowIdx + (nextCol >= NUM_COLS ? 1 : 0);
                      const nextColIdx = nextCol % NUM_COLS;
                      if (nextRow < NUM_ROWS) {
                        const nextInputRef = inputRefs[nextRow]?.[nextColIdx];
                        nextInputRef?.focus();
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullContainer: { flex: 1, backgroundColor: "#f5f5f5" },
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  header: { fontSize: 20, fontWeight: "bold", margin: 16 },
  row: { flexDirection: "row" },
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
  }
});