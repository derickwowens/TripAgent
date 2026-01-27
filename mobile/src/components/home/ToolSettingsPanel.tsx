import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Dimensions,
} from 'react-native';
import { ToolSettings, ToolConfig } from '../../hooks/useToolSettings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ToolSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  settings: ToolSettings;
  onToggleTool: (toolId: string) => void;
  onSetLanguageModel: (model: ToolSettings['languageModel']) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  enabledCount: number;
  totalCount: number;
}

const CATEGORY_LABELS: Record<ToolConfig['category'], string> = {
  parks: '🏞️ National Parks',
  travel: '✈️ Transportation',
  lodging: '🏨 Lodging',
  food: '🍽️ Dining',
  activities: '🎯 Activities',
};

const CATEGORY_ORDER: ToolConfig['category'][] = ['parks', 'travel', 'lodging', 'food', 'activities'];

export const ToolSettingsPanel: React.FC<ToolSettingsPanelProps> = ({
  visible,
  onClose,
  settings,
  onToggleTool,
  onSetLanguageModel,
  onEnableAll,
  onDisableAll,
  enabledCount,
  totalCount,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['parks']));

  if (!visible) return null;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const toolsByCategory = CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = settings.tools.filter(t => t.category === category);
    return acc;
  }, {} as Record<ToolConfig['category'], ToolConfig[]>);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🔧</Text>
          <Text style={styles.headerTitle}>Tool Settings</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            More tools = more comprehensive responses, but longer wait times. Disable tools you don't need to speed up responses.
          </Text>
        </View>

        {/* Language Model Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 Language Model</Text>
          <View style={styles.modelOptions}>
            <TouchableOpacity
              style={[
                styles.modelOption,
                settings.languageModel === 'claude-sonnet-4-20250514' && styles.modelOptionSelected,
              ]}
              onPress={() => onSetLanguageModel('claude-sonnet-4-20250514')}
            >
              <Text style={[
                styles.modelOptionText,
                settings.languageModel === 'claude-sonnet-4-20250514' && styles.modelOptionTextSelected,
              ]}>
                Claude Sonnet 4
              </Text>
              <Text style={styles.modelOptionSubtext}>Balanced • Recommended</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modelOption,
                settings.languageModel === 'claude-3-5-haiku-20241022' && styles.modelOptionSelected,
              ]}
              onPress={() => onSetLanguageModel('claude-3-5-haiku-20241022')}
            >
              <Text style={[
                styles.modelOptionText,
                settings.languageModel === 'claude-3-5-haiku-20241022' && styles.modelOptionTextSelected,
              ]}>
                Claude 3.5 Haiku
              </Text>
              <Text style={styles.modelOptionSubtext}>Faster • Less detailed</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.toolCountText}>
            {enabledCount} of {totalCount} tools enabled
          </Text>
          <View style={styles.quickActionButtons}>
            <TouchableOpacity style={styles.quickActionButton} onPress={onEnableAll}>
              <Text style={styles.quickActionText}>Enable All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={onDisableAll}>
              <Text style={styles.quickActionText}>Disable All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tool Categories */}
        {CATEGORY_ORDER.map(category => {
          const tools = toolsByCategory[category];
          const enabledInCategory = tools.filter(t => t.enabled).length;
          const isExpanded = expandedCategories.has(category);

          return (
            <View key={category} style={styles.categorySection}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category)}
              >
                <Text style={styles.categoryTitle}>
                  {isExpanded ? '▼' : '▶'} {CATEGORY_LABELS[category]}
                </Text>
                <Text style={styles.categoryCount}>
                  {enabledInCategory}/{tools.length}
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.toolList}>
                  {tools.map(tool => (
                    <View key={tool.id} style={styles.toolItem}>
                      <View style={styles.toolInfo}>
                        <Text style={styles.toolName}>{tool.name}</Text>
                        <Text style={styles.toolDescription}>{tool.description}</Text>
                      </View>
                      <Switch
                        value={tool.enabled}
                        onValueChange={() => onToggleTool(tool.id)}
                        trackColor={{ false: '#3e3e3e', true: 'rgba(22, 101, 52, 0.6)' }}
                        thumbColor={tool.enabled ? '#22c55e' : '#9ca3af'}
                        ios_backgroundColor="#3e3e3e"
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a2e',
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollContent: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 10,
    padding: 12,
    margin: 16,
    marginBottom: 8,
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  modelOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  modelOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  modelOptionSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.3)',
    borderColor: 'rgba(22, 101, 52, 0.6)',
  },
  modelOptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  modelOptionTextSelected: {
    color: '#22c55e',
  },
  modelOptionSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toolCountText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  quickActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },
  quickActionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  categorySection: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  categoryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  toolList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  toolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  toolInfo: {
    flex: 1,
    marginRight: 12,
  },
  toolName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  toolDescription: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});
