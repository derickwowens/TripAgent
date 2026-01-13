import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ModelOption {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-3-5-haiku-20241022', name: 'Haiku', icon: '⚡', desc: 'Fast' },
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet', icon: '⭐', desc: 'Balanced' },
  { id: 'claude-opus-4-20250514', name: 'Opus', icon: '🧠', desc: 'Advanced' },
];

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>AI Model</Text>
      <View style={styles.optionsRow}>
        {MODEL_OPTIONS.map((model) => (
          <TouchableOpacity
            key={model.id}
            style={[
              styles.option,
              selectedModel === model.id && styles.optionSelected,
            ]}
            onPress={() => onSelectModel(model.id)}
          >
            <Text style={styles.modelIcon}>{model.icon}</Text>
            <Text style={[
              styles.modelName,
              selectedModel === model.id && styles.modelNameSelected,
            ]}>{model.name}</Text>
            <Text style={styles.modelDesc}>{model.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.4)',
    borderColor: '#166534',
  },
  modelIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  modelName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  modelNameSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modelDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    marginTop: 1,
  },
});
