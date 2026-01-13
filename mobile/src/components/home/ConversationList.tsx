import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SavedConversation } from '../../hooks';

interface ConversationListProps {
  conversations: SavedConversation[];
  currentConversationId: string | null;
  onLoadConversation: (conversation: SavedConversation) => void;
  onDeleteConversation: (id: string) => void;
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

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
}) => {
  return (
    <>
      <Text style={styles.title}>Saved Trips</Text>
      <View style={styles.list}>
        {conversations.map((conv) => (
          <View
            key={conv.id}
            style={[
              styles.item,
              currentConversationId === conv.id && styles.activeItem,
            ]}
          >
            <TouchableOpacity
              style={styles.content}
              onPress={() => onLoadConversation(conv)}
            >
              <View style={styles.header}>
                <Text style={styles.destination}>
                  {conv.metadata.destination ? `🏞️ ${conv.metadata.destination}` : '💬 Trip Planning'}
                </Text>
                <Text style={styles.date}>
                  {formatDate(conv.metadata.updatedAt)}
                </Text>
              </View>
              <View style={styles.meta}>
                {conv.metadata.travelers && (
                  <Text style={styles.metaTag}>👥 {conv.metadata.travelers}</Text>
                )}
                {conv.metadata.departingFrom && (
                  <Text style={styles.metaTag}>✈️ {conv.metadata.departingFrom}</Text>
                )}
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {conv.messages[0]?.content || 'Empty conversation'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeleteConversation(conv.id)}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}

        {conversations.length === 0 && (
          <Text style={styles.emptyText}>No saved conversations yet</Text>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 12,
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
  deleteButton: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 40,
    fontSize: 15,
  },
});
