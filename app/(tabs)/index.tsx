import React, { useState } from 'react';
import { Button, FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

type TableRow = {
  id: string;
  name: string;
  age: string;
  city: string;
};

export default function HomeScreen() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");

  // Typ explizit angeben
  const [table, setTable] = useState<TableRow[]>([]);

  // Neue Tabellenzeile hinzufügen
  const addRow = () => {
    if (name.trim() !== "" && age.trim() !== "" && city.trim() !== "") {
      setTable([...table, { id: Date.now().toString(), name, age, city }]);
      setName("");
      setAge("");
      setCity("");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>📊 Mehrspaltige Tabelle (lokal)</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Alter"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Stadt"
          value={city}
          onChangeText={setCity}
        />
      </View>

      <Button title="Hinzufügen" onPress={addRow} />

      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.headerCell]}>Name</Text>
        <Text style={[styles.cell, styles.headerCell]}>Alter</Text>
        <Text style={[styles.cell, styles.headerCell]}>Stadt</Text>
      </View>

      <FlatList
        data={table}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.cell}>{item.name}</Text>
            <Text style={styles.cell}>{item.age}</Text>
            <Text style={styles.cell}>{item.city}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  inputContainer: { marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 8, marginVertical: 5, borderRadius: 5 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 2, borderColor: "#333", marginTop: 15 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ccc" },
  cell: { flex: 1, padding: 8 },
  headerCell: { fontWeight: "bold" }
});
