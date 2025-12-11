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
import { useRouter } from 'expo-router';
import { useAppStore, Field } from '@/store/appStore';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

// Mock data for demonstration
const mockFields: Field[] = [
  {
    id: 1,
    name: 'Fazenda São João',
    description: 'Área principal de soja',
    areaHectares: 150,
    city: 'Sorriso',
    state: 'MT',
    soilType: 'Latossolo Vermelho',
    isActive: true,
  },
  {
    id: 2,
    name: 'Talhão Norte',
    description: 'Milho safrinha',
    areaHectares: 80,
    city: 'Lucas do Rio Verde',
    state: 'MT',
    soilType: 'Argissolo',
    isActive: true,
  },
  {
    id: 3,
    name: 'Área Experimental',
    description: 'Testes de novas variedades',
    areaHectares: 25,
    city: 'Sinop',
    state: 'MT',
    soilType: 'Latossolo Amarelo',
    isActive: true,
  },
];

function FieldCard({ field, onPress }: { field: Field; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View style={[styles.fieldIcon, { backgroundColor: colors.primaryLight + '20' }]}>
            <Ionicons name="leaf" size={24} color={colors.primary} />
          </View>
          <View style={styles.fieldInfo}>
            <Text style={[styles.fieldName, { color: colors.text }]}>{field.name}</Text>
            <Text style={[styles.fieldLocation, { color: colors.textSecondary }]}>
              {field.city}, {field.state}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>
        
        <View style={[styles.fieldStats, { borderTopColor: colors.border }]}>
          <View style={styles.statItem}>
            <Ionicons name="resize" size={16} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {field.areaHectares} ha
            </Text>
          </View>
          {field.soilType && (
            <View style={styles.statItem}>
              <Ionicons name="earth" size={16} color={colors.textSecondary} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {field.soilType}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function FieldsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { fields, setFields } = useAppStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Initialize with mock data if empty
  React.useEffect(() => {
    if (fields.length === 0) {
      setFields(mockFields);
    }
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const displayFields = fields.length > 0 ? fields : mockFields;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Meus Campos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {displayFields.length} campos cadastrados
          </Text>
        </View>
        <Button
          title="Novo"
          size="sm"
          onPress={() => router.push('/fields/new')}
          icon={<Ionicons name="add" size={18} color="#fff" />}
        />
      </View>

      {/* Fields List */}
      <FlatList
        data={displayFields}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <FieldCard
            field={item}
            onPress={() => router.push(`/fields/${item.id}`)}
          />
        )}
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
            <Ionicons name="leaf-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nenhum campo cadastrado
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Adicione seu primeiro campo para começar
            </Text>
            <Button
              title="Adicionar Campo"
              onPress={() => router.push('/fields/new')}
              style={{ marginTop: Spacing.lg }}
            />
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
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  fieldCard: {
    marginBottom: Spacing.md,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  fieldLocation: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  fieldStats: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  statText: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.xs,
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
  emptySubtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
