import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, Linking, ScrollView } from 'react-native';
import { ProfileSection } from './ProfileSection';
import { ModelSelector } from './ModelSelector';
import { ConversationList } from './ConversationList';
import { SavedConversation } from '../../hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  userProfile: string;
  profileExpanded: boolean;
  onToggleProfile: () => void;
  onSaveProfile: (profile: string) => void;
  onAddProfileSuggestion: (suggestion: string) => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  conversations: SavedConversation[];
  currentConversationId: string | null;
  onLoadConversation: (conversation: SavedConversation) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onGenerateItinerary: (conversation: SavedConversation) => void;
  onUpdateConversation: (id: string, updates: { title?: string; description?: string }) => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  visible,
  onClose,
  userProfile,
  profileExpanded,
  onToggleProfile,
  onSaveProfile,
  onAddProfileSuggestion,
  selectedModel,
  onSelectModel,
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  onNewConversation,
  onGenerateItinerary,
  onUpdateConversation,
}) => {
  const handleLoadConversation = (conv: SavedConversation) => {
    onLoadConversation(conv);
    onClose();
  };

  const handleNewConversation = () => {
    onNewConversation();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.menu}>
          <View style={styles.header}>
            <Text style={styles.title}>Recent Trips</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
          >
            <ProfileSection
              userProfile={userProfile}
              profileExpanded={profileExpanded}
              onToggleExpanded={onToggleProfile}
              onSaveProfile={onSaveProfile}
              onAddSuggestion={onAddProfileSuggestion}
            />

            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
            />

            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onLoadConversation={handleLoadConversation}
              onDeleteConversation={onDeleteConversation}
              onGenerateItinerary={onGenerateItinerary}
              onUpdateConversation={onUpdateConversation}
            />

            <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
              <Text style={styles.newChatText}>+ New Conversation</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.surveyButton} 
              onPress={() => Linking.openURL('https://travel-buddy-api-production.up.railway.app/public/survey.html')}
            >
              <Text style={styles.surveyText}>📝 Send Feedback</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <TouchableOpacity 
          style={styles.backdrop} 
          onPress={onClose}
          activeOpacity={1}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  menu: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#1a1a2e',
    height: '100%',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  newChatButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#166534',
    borderRadius: 12,
    alignItems: 'center',
  },
  newChatText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  surveyButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  surveyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
});
