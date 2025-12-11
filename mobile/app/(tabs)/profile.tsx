import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface MenuItem {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  color?: string;
}

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  const { colors } = useTheme();

  return (
    <View style={styles.menuSection}>
      <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Card padding={false}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            activeOpacity={0.7}
            style={[
              styles.menuItem,
              index < items.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: (item.color || colors.primary) + '15' }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color || colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuItemTitle, { color: colors.text }]}>{item.title}</Text>
              {item.subtitle && (
                <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              )}
            </View>
            {item.showArrow !== false && (
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        ))}
      </Card>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, theme, setTheme, isDark } = useTheme();

  const accountItems: MenuItem[] = [
    {
      icon: 'person-outline',
      title: 'Dados Pessoais',
      subtitle: 'Nome, email, telefone',
      onPress: () => {},
    },
    {
      icon: 'business-outline',
      title: 'Fazenda / Empresa',
      subtitle: 'Informações da propriedade',
      onPress: () => {},
    },
    {
      icon: 'notifications-outline',
      title: 'Notificações',
      subtitle: 'Alertas e lembretes',
      onPress: () => {},
    },
  ];

  const settingsItems: MenuItem[] = [
    {
      icon: isDark ? 'moon' : 'sunny',
      title: 'Tema',
      subtitle: theme === 'system' ? 'Automático' : isDark ? 'Escuro' : 'Claro',
      onPress: () => {
        const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
        const currentIndex = themes.indexOf(theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        setTheme(themes[nextIndex]);
      },
    },
    {
      icon: 'language-outline',
      title: 'Idioma',
      subtitle: 'Português (Brasil)',
      onPress: () => {},
    },
    {
      icon: 'map-outline',
      title: 'Unidades de Medida',
      subtitle: 'Hectares, km',
      onPress: () => {},
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: 'help-circle-outline',
      title: 'Central de Ajuda',
      onPress: () => {},
    },
    {
      icon: 'chatbubble-outline',
      title: 'Fale Conosco',
      onPress: () => {},
    },
    {
      icon: 'star-outline',
      title: 'Avaliar o App',
      onPress: () => {},
      color: '#f59e0b',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Perfil</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileSection}>
          <Card>
            <View style={styles.profileContent}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>MG</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  Manoel Giansante
                </Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                  manoelgiansante@gmail.com
                </Text>
                <View style={[styles.profileBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="leaf" size={12} color={colors.primary} />
                  <Text style={[styles.profileBadgeText, { color: colors.primary }]}>
                    Produtor Rural
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <Card>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>3</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Campos</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>255</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hectares</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>12</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Notas</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Menu Sections */}
        <MenuSection title="CONTA" items={accountItems} />
        <MenuSection title="CONFIGURAÇÕES" items={settingsItems} />
        <MenuSection title="SUPORTE" items={supportItems} />

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <Button
            title="Sair da Conta"
            variant="outline"
            onPress={() => {}}
            icon={<Ionicons name="log-out-outline" size={20} color={colors.error} />}
            style={{ borderColor: colors.error }}
            textStyle={{ color: colors.error }}
          />
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textTertiary }]}>
          Campo Vivo v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  profileSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: '#fff',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  profileEmail: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  profileBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginLeft: 4,
  },
  statsSection: {
    paddingHorizontal: Spacing.md,
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
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  menuSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  menuTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  menuItemSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  logoutSection: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    paddingVertical: Spacing.lg,
  },
});
