import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface Note {
  id: number;
  title: string;
  content: string;
  fieldName: string;
  noteType: 'observation' | 'problem' | 'task' | 'harvest' | 'application';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  isResolved: boolean;
  createdAt: string;
}

// Mock data
const mockNotes: Note[] = [
  {
    id: 1,
    title: 'Infestação de pragas detectada',
    content: 'Encontrado percevejo marrom no talhão norte. Necessário aplicação de defensivo.',
    fieldName: 'Fazenda São João',
    noteType: 'problem',
    severity: 'high',
    isResolved: false,
    createdAt: '2025-12-10',
  },
  {
    id: 2,
    title: 'Aplicação de herbicida',
    content: 'Realizada aplicação de glifosato para controle de plantas daninhas.',
    fieldName: 'Talhão Norte',
    noteType: 'application',
    isResolved: true,
    createdAt: '2025-12-09',
  },
  {
    id: 3,
    title: 'Verificar irrigação',
    content: 'Checar sistema de irrigação por gotejamento - possível vazamento.',
    fieldName: 'Área Experimental',
    noteType: 'task',
    severity: 'medium',
    isResolved: false,
    createdAt: '2025-12-08',
  },
];

function getNoteIcon(noteType: string) {
  switch (noteType) {
    case 'problem':
      return 'warning';
    case 'task':
      return 'checkbox';
    case 'harvest':
      return 'nutrition';
    case 'application':
      return 'flask';
    default:
      return 'eye';
  }
}

function getNoteColor(noteType: string, severity?: string) {
  if (noteType === 'problem') {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  }
  switch (noteType) {
    case 'task':
      return '#8b5cf6';
    case 'harvest':
      return '#22c55e';
    case 'application':
      return '#06b6d4';
    default:
      return '#6b7280';
  }
}

function NoteCard({ note }: { note: Note }) {
  const { colors } = useTheme();
  const iconColor = getNoteColor(note.noteType, note.severity);

  return (
    <TouchableOpacity activeOpacity={0.7}>
      <Card style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <View style={[styles.noteIcon, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={getNoteIcon(note.noteType) as any} size={20} color={iconColor} />
          </View>
          <View style={styles.noteInfo}>
            <Text style={[styles.noteTitle, { color: colors.text }]} numberOfLines={1}>
              {note.title}
            </Text>
            <Text style={[styles.noteField, { color: colors.textSecondary }]}>
              {note.fieldName} • {note.createdAt}
            </Text>
          </View>
          {note.isResolved ? (
            <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.success }]}>Resolvido</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.warning + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.warning }]}>Pendente</Text>
            </View>
          )}
        </View>
        <Text style={[styles.noteContent, { color: colors.textSecondary }]} numberOfLines={2}>
          {note.content}
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

export default function NotesScreen() {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'resolved'>('all');

  const filteredNotes = mockNotes.filter((note) => {
    if (filter === 'pending') return !note.isResolved;
    if (filter === 'resolved') return note.isResolved;
    return true;
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Notas de Campo</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {mockNotes.length} registros
          </Text>
        </View>
        <Button
          title="Nova"
          size="sm"
          onPress={() => {}}
          icon={<Ionicons name="add" size={18} color="#fff" />}
        />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'pending', 'resolved'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterButton,
              {
                backgroundColor: filter === f ? colors.primary : colors.surface,
                borderColor: filter === f ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f ? '#fff' : colors.textSecondary },
              ]}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Resolvidas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notes List */}
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <NoteCard note={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nenhuma nota encontrada
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  noteCard: {
    marginBottom: Spacing.md,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  noteInfo: {
    flex: 1,
  },
  noteTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  noteField: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  noteContent: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
  },
});
