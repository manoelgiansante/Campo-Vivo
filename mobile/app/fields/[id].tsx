import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function FieldDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fields } = useAppStore();
  
  const field = fields.find((f) => f.id === parseInt(id || '0'));

  if (!field) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle" size={64} color={colors.textTertiary} />
          <Text style={[styles.notFoundText, { color: colors.text }]}>
            Campo não encontrado
          </Text>
          <Button
            title="Voltar"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: field.name,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerLeft: () => (
            <Button
              title=""
              variant="ghost"
              onPress={() => router.back()}
              icon={<Ionicons name="arrow-back" size={24} color={colors.text} />}
            />
          ),
          headerRight: () => (
            <Button
              title=""
              variant="ghost"
              onPress={() => {}}
              icon={<Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />}
            />
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Map Preview */}
          <View style={[styles.mapPreview, { backgroundColor: colors.surface }]}>
            <Ionicons name="map" size={48} color={colors.primary} />
            <Text style={[styles.mapPreviewText, { color: colors.textSecondary }]}>
              Visualização do Mapa
            </Text>
          </View>

          {/* Quick Stats */}
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="resize" size={24} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {field.areaHectares || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Hectares
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Ionicons name="location" size={24} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {field.city || '-'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Cidade
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Ionicons name="earth" size={24} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                  {field.soilType || '-'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Solo
                </Text>
              </View>
            </View>
          </Card>

          {/* Description */}
          {field.description && (
            <Card title="Descrição">
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {field.description}
              </Text>
            </Card>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Ver no Mapa"
              variant="outline"
              onPress={() => router.push('/')}
              icon={<Ionicons name="map-outline" size={20} color={colors.primary} />}
              style={styles.actionButton}
            />
            <Button
              title="Nova Nota"
              onPress={() => {}}
              icon={<Ionicons name="add" size={20} color="#fff" />}
              style={styles.actionButton}
            />
          </View>

          {/* Recent Notes Section */}
          <Card title="Notas Recentes" subtitle="Últimas atualizações do campo">
            <View style={styles.emptyNotes}>
              <Ionicons name="document-text-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptyNotesText, { color: colors.textSecondary }]}>
                Nenhuma nota registrada
              </Text>
              <Button
                title="Adicionar Nota"
                size="sm"
                variant="outline"
                onPress={() => {}}
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  mapPreview: {
    height: 200,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mapPreviewText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
  statsCard: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
  },
  description: {
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    marginVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  emptyNotes: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyNotesText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
  },
});
