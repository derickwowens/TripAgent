import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ModelOption {
  id: string;
  name: string;
  tier: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Haiku',
    tier: '⚡ Fast',
    description: 'Quick responses, basic trip info',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Sonnet',
    tier: '⭐ Balanced',
    description: 'Best for most trip planning',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Opus',
    tier: '🧠 Advanced',
    description: 'Complex itineraries & deep research',
  },
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
      {MODEL_OPTIONS.map((model) => (
        <TouchableOpacity
          key={model.id}
          style={[
            styles.option,
            selectedModel === model.id && styles.optionSelected,
          ]}
          onPress={() => onSelectModel(model.id)}
        >
          <View style={styles.optionHeader}>
            <Text style={styles.modelName}>{model.name}</Text>
            <Text style={styles.modelTier}>{model.tier}</Text>
          </View>
          <Text style={styles.modelDescription}>{model.description}</Text>
          {selectedModel === model.id && (
            <Text style={styles.selectedIndicator}>✓ Selected</Text>
          )}
        </TouchableOpacity>
      ))}
      <Text style={styles.note}>
        💡 Haiku is fastest, Sonnet balances speed & quality, Opus handles complex planning
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  option: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.3)',
    borderColor: '#166534',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modelTier: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  modelDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  selectedIndicator: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  note: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
});
