import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, Linking, ScrollView, Image } from 'react-native';
import { ProfileSection } from './ProfileSection';
import { ConversationList } from './ConversationList';
import { SavedConversation, useDarkModeContext } from '../../hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DarkModeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkModeContext();
  
  return (
    <TouchableOpacity 
      style={styles.darkModeToggle} 
      onPress={toggleDarkMode}
      activeOpacity={0.7}
    >
      <Text style={styles.darkModeIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  );
};

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  userProfile: string;
  onSaveProfile: (profile: string) => void;
  onAddProfileSuggestion: (suggestion: string) => void;
  conversations: SavedConversation[];
  currentConversationId: string | null;
  onLoadConversation: (conversation: SavedConversation) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onUpdateConversation: (id: string, updates: { title?: string; description?: string }) => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  visible,
  onClose,
  userProfile,
  onSaveProfile,
  onAddProfileSuggestion,
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  onNewConversation,
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
          {/* Fixed Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <TouchableOpacity 
                style={styles.feedbackButton} 
                onPress={() => Linking.openURL('https://travel-buddy-api-production.up.railway.app/public/survey.html')}
              >
                <Text style={styles.feedbackText}>Feedback</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.headerRight}>
              <DarkModeToggle />
              <TouchableOpacity onPress={onClose} style={styles.closeButtonContainer}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
          >
            <ProfileSection
              userProfile={userProfile}
              onSaveProfile={onSaveProfile}
              onAddSuggestion={onAddProfileSuggestion}
            />

            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onLoadConversation={handleLoadConversation}
              onDeleteConversation={onDeleteConversation}
              onUpdateConversation={onUpdateConversation}
            />

            <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.newChatIcon}
                resizeMode="contain"
              />
              <Text style={styles.newChatText}>New Trip</Text>
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
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  closeButton: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  darkModeToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  darkModeIcon: {
    fontSize: 18,
  },
  feedbackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  feedbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  closeButtonContainer: {
    padding: 4,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#166534',
    borderRadius: 10,
    gap: 8,
  },
  newChatIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  newChatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
