import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Define a set of boutique-ready pastel colors
const PASTEL_PALETTE = [
  { name: 'Black', hex: '#000000' },
  { name: 'Dusty Rose', hex: '#DCAE96' },
  { name: 'Sage', hex: '#B2AC88' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Baby Blue', hex: '#89CFF0' },
  { name: 'Lemon', hex: '#FAFA33' },
  { name: 'Peach', hex: '#FFDAB9' },
  { name: 'Mint', hex: '#98FF98' },
];

const ColorPicker = ({ onSelect, activeColor }) => {
  const [customColors, setCustomColors] = useState([]);
  const [customHex, setCustomHex] = useState('');

  const addCustomColor = () => {
    if (customHex.match(/^#[0-9A-Fa-f]{6}$/)) {
      const newColor = { name: `Custom ${customColors.length + 1}`, hex: customHex };
      setCustomColors([...customColors, newColor]);
      setCustomHex('');
    } else {
      Alert.alert('Invalid Hex', 'Please enter a valid hex color code, e.g., #FF0000');
    }
  };

  const allColors = [...PASTEL_PALETTE, ...customColors];

  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>Select Fabric Shade:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {allColors.map((color) => (
          <TouchableOpacity
            key={color.hex}
            style={[
              styles.colorCircle,
              { backgroundColor: color.hex },
              activeColor === color.hex && styles.activeCircle,
            ]}
            onPress={() => onSelect(color.hex)}
          />
        ))}
      </ScrollView>

      <View style={styles.customColorContainer}>
        <Text style={styles.customLabel}>Add Custom Shade:</Text>
        <TextInput
          style={styles.hexInput}
          placeholder="#FFFFFF"
          value={customHex}
          onChangeText={setCustomHex}
          maxLength={7}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomColor}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerContainer: { marginBottom: 16, paddingHorizontal: 16 },
  pickerLabel: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  activeCircle: {
    borderColor: '#fff',
    borderWidth: 3,
  },
  customColorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  customLabel: { color: '#fff', fontWeight: '600', marginRight: 8 },
  hexInput: { flex: 1, backgroundColor: '#444', color: '#fff', padding: 8, borderRadius: 4, marginRight: 8 },
  addButton: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 },
  addButtonText: { color: '#fff', fontWeight: '600' },
});

export default ColorPicker;
