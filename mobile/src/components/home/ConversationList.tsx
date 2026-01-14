import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, ImageBackground } from 'react-native';
import { SavedConversation } from '../../hooks';

interface ConversationListProps {
  conversations: SavedConversation[];
  currentConversationId: string | null;
  onLoadConversation: (conversation: SavedConversation) => void;
  onDeleteConversation: (id: string) => void;
  onUpdateConversation: (id: string, updates: { title?: string; description?: string }) => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  onUpdateConversation,
}) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingConv, setEditingConv] = useState<SavedConversation | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort by last updated and filter by search (title, destination, description, AND message content)
  const filteredConversations = useMemo(() => {
    let sorted = [...conversations].sort((a, b) => 
      new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime()
    );
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sorted = sorted.filter(conv => {
        const title = conv.metadata.title?.toLowerCase() || '';
        const destination = conv.metadata.destination?.toLowerCase() || '';
        const description = conv.metadata.description?.toLowerCase() || '';
        // Also search through all message content
        const messageContent = conv.messages
          .map(m => m.content.toLowerCase())
          .join(' ');
        return title.includes(query) || 
               destination.includes(query) || 
               description.includes(query) ||
               messageContent.includes(query);
      });
    }
    
    return sorted;
  }, [conversations, searchQuery]);

  const openEditModal = (conv: SavedConversation) => {
    setEditingConv(conv);
    setEditTitle(conv.metadata.title || conv.metadata.destination || '');
    setEditDescription(conv.metadata.description || '');
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    if (editingConv) {
      onUpdateConversation(editingConv.id, {
        title: editTitle.trim() || undefined,
        description: editDescription.trim() || undefined,
      });
    }
    setEditModalVisible(false);
    setEditingConv(null);
  };

  const getDisplayTitle = (conv: SavedConversation) => {
    if (conv.metadata.title) return conv.metadata.title;
    if (conv.metadata.destination) return conv.metadata.destination;
    return 'Trip Planning';
  };

  // Get first photo URL from conversation messages
  const getConversationPhoto = (conv: SavedConversation): string | null => {
    for (const msg of conv.messages) {
      if (msg.photos && msg.photos.length > 0) {
        return msg.photos[0].url;
      }
    }
    return null;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Saved Trips</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {filteredConversations.map((conv) => {
          const photoUrl = getConversationPhoto(conv);
          
          const TileContent = (
            <>
              <TouchableOpacity
                style={styles.content}
                onPress={() => onLoadConversation(conv)}
                onLongPress={() => openEditModal(conv)}
              >
                <View style={styles.header}>
                  <Text style={styles.destination} numberOfLines={1}>
                    {getDisplayTitle(conv)}
                  </Text>
                </View>
                <View style={styles.dateRow}>
                  <Text style={styles.date}>{formatDate(conv.metadata.updatedAt)}</Text>
                </View>
                {conv.metadata.description ? (
                  <Text style={styles.description} numberOfLines={1}>
                    {conv.metadata.description}
                  </Text>
                ) : (
                  <View style={styles.meta}>
                    {conv.metadata.duration && (
                      <Text style={styles.metaTag}>{conv.metadata.duration}</Text>
                    )}
                    {conv.metadata.travelDates && (
                      <Text style={styles.metaTag}>{conv.metadata.travelDates}</Text>
                    )}
                    {conv.metadata.travelers && (
                      <Text style={styles.metaTag}>{conv.metadata.travelers} travelers</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBadge}
                  onPress={() => openEditModal(conv)}
                >
                  <Text style={styles.actionIcon}>•••</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBadge, styles.deleteBadge]}
                  onPress={() => onDeleteConversation(conv.id)}
                >
                  <Text style={[styles.actionIcon, styles.deleteIcon]}>×</Text>
                </TouchableOpacity>
              </View>
            </>
          );

          return (
            <View
              key={conv.id}
              style={[
                styles.item,
                currentConversationId === conv.id && styles.activeItem,
              ]}
            >
              {photoUrl ? (
                <ImageBackground
                  source={{ uri: photoUrl }}
                  style={styles.itemWithPhoto}
                  imageStyle={styles.itemBackgroundImage}
                >
                  <View style={styles.photoOverlay}>
                    {TileContent}
                  </View>
                </ImageBackground>
              ) : (
                TileContent
              )}
            </View>
          );
        })}

        {filteredConversations.length === 0 && conversations.length > 0 && (
          <Text style={styles.emptyText}>No trips match your search</Text>
        )}
        {conversations.length === 0 && (
          <Text style={styles.emptyText}>No saved conversations yet</Text>
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Trip</Text>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Trip name..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              maxLength={50}
            />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add notes about your trip..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              maxLength={150}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveEdit}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    color: '#FFFFFF',
    width: 180,
    height: 28,
  },
  list: {
    paddingHorizontal: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  dateSeparator: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeItem: {
    backgroundColor: 'rgba(22, 101, 52, 0.3)',
    borderColor: '#166534',
  },
  content: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  destination: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  date: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  meta: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  metaTag: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  preview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  summary: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'column',
    paddingRight: 8,
    gap: 4,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 40,
    fontSize: 15,
  },
  description: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  actionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(22, 101, 52, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadge: {
    backgroundColor: 'rgba(22, 101, 52, 0.25)',
  },
  actionIcon: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  deleteIcon: {
    fontSize: 18,
    fontWeight: '300',
  },
  itemWithPhoto: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  itemBackgroundImage: {
    opacity: 0.3,
    borderRadius: 12,
  },
  photoOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(26,26,46,0.7)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  inputMultiline: {
    height: 70,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#166534',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
