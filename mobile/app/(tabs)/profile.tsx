import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Share,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useAppStore } from '@/store/appStore';
import * as WebBrowser from 'expo-web-browser';

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
  const { fields, user, setUser } = useAppStore();
  
  // Estados para modais
  const [showPersonalData, setShowPersonalData] = useState(false);
  const [showFarmData, setShowFarmData] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  
  // Estados para dados pessoais
  const [userName, setUserName] = useState('Manoel Giansante');
  const [userEmail, setUserEmail] = useState('manoelgiansante@gmail.com');
  const [userPhone, setUserPhone] = useState('(11) 99999-9999');
  
  // Estados para fazenda
  const [farmName, setFarmName] = useState('Fazenda Campo Vivo');
  const [farmCity, setFarmCity] = useState('Sorriso');
  const [farmState, setFarmState] = useState('MT');
  
  // Estados para notificações
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [notifyWeather, setNotifyWeather] = useState(true);
  const [notifyTasks, setNotifyTasks] = useState(false);
  
  // Estados para unidades
  const [areaUnit, setAreaUnit] = useState<'hectares' | 'alqueires'>('hectares');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'milhas'>('km');

  // Calcular estatísticas reais
  const totalFields = fields.length || 3;
  const totalHectares = fields.reduce((acc, f) => acc + (f.areaHectares || 0), 0) || 255;

  // Funções de ação
  const handleOpenHelp = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://campo-vivo-one.vercel.app/ajuda');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir a página de ajuda.');
    }
  };

  const handleContactUs = () => {
    Alert.alert(
      'Fale Conosco',
      'Como você prefere entrar em contato?',
      [
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:suporte@campovivo.com.br?subject=Suporte Campo Vivo'),
        },
        {
          text: 'WhatsApp',
          onPress: () => Linking.openURL('https://wa.me/5511999999999?text=Olá! Preciso de ajuda com o app Campo Vivo'),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleRateApp = () => {
    Alert.alert(
      'Avaliar o App',
      'Sua avaliação é muito importante para nós! Você será redirecionado para a loja de aplicativos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Avaliar',
          onPress: () => {
            // iOS App Store ou Google Play
            Linking.openURL('https://apps.apple.com/app/campo-vivo/id123456789');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            setUser(null);
            Alert.alert('Sucesso', 'Você foi desconectado com sucesso.');
          },
        },
      ]
    );
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Conheça o Campo Vivo! O melhor app para gestão de fazendas. Baixe agora: https://campovivo.com.br/download',
        title: 'Campo Vivo - Gestão de Fazendas',
      });
    } catch (error) {
      console.log('Erro ao compartilhar:', error);
    }
  };

  const accountItems: MenuItem[] = [
    {
      icon: 'person-outline',
      title: 'Dados Pessoais',
      subtitle: 'Nome, email, telefone',
      onPress: () => setShowPersonalData(true),
    },
    {
      icon: 'business-outline',
      title: 'Fazenda / Empresa',
      subtitle: 'Informações da propriedade',
      onPress: () => setShowFarmData(true),
    },
    {
      icon: 'notifications-outline',
      title: 'Notificações',
      subtitle: 'Alertas e lembretes',
      onPress: () => setShowNotifications(true),
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
      onPress: () => setShowLanguage(true),
    },
    {
      icon: 'map-outline',
      title: 'Unidades de Medida',
      subtitle: `${areaUnit === 'hectares' ? 'Hectares' : 'Alqueires'}, ${distanceUnit}`,
      onPress: () => setShowUnits(true),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: 'help-circle-outline',
      title: 'Central de Ajuda',
      onPress: handleOpenHelp,
    },
    {
      icon: 'chatbubble-outline',
      title: 'Fale Conosco',
      onPress: handleContactUs,
    },
    {
      icon: 'share-social-outline',
      title: 'Compartilhar App',
      onPress: handleShareApp,
      color: '#3b82f6',
    },
    {
      icon: 'star-outline',
      title: 'Avaliar o App',
      onPress: handleRateApp,
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
            <TouchableOpacity 
              style={styles.profileContent}
              onPress={() => setShowPersonalData(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{userName.split(' ').map(n => n[0]).join('').substring(0, 2)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  {userName}
                </Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                  {userEmail}
                </Text>
                <View style={[styles.profileBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="leaf" size={12} color={colors.primary} />
                  <Text style={[styles.profileBadgeText, { color: colors.primary }]}>
                    Produtor Rural
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <Card>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{totalFields}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Campos</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{totalHectares}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {areaUnit === 'hectares' ? 'Hectares' : 'Alqueires'}
                </Text>
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
            onPress={handleLogout}
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

      {/* Modal - Dados Pessoais */}
      <Modal
        visible={showPersonalData}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPersonalData(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPersonalData(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Dados Pessoais</Text>
            <TouchableOpacity onPress={() => {
              Alert.alert('Sucesso', 'Dados salvos com sucesso!');
              setShowPersonalData(false);
            }}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nome Completo</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={userName}
              onChangeText={setUserName}
              placeholder="Seu nome"
              placeholderTextColor={colors.textTertiary}
            />
            
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={userEmail}
              onChangeText={setUserEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Telefone</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={userPhone}
              onChangeText={setUserPhone}
              placeholder="(00) 00000-0000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal - Fazenda */}
      <Modal
        visible={showFarmData}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFarmData(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFarmData(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Fazenda / Empresa</Text>
            <TouchableOpacity onPress={() => {
              Alert.alert('Sucesso', 'Dados salvos com sucesso!');
              setShowFarmData(false);
            }}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nome da Fazenda</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={farmName}
              onChangeText={setFarmName}
              placeholder="Nome da propriedade"
              placeholderTextColor={colors.textTertiary}
            />
            
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cidade</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={farmCity}
              onChangeText={setFarmCity}
              placeholder="Cidade"
              placeholderTextColor={colors.textTertiary}
            />
            
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Estado</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={farmState}
              onChangeText={setFarmState}
              placeholder="UF"
              placeholderTextColor={colors.textTertiary}
              maxLength={2}
              autoCapitalize="characters"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal - Notificações */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifications(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Notificações</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Alertas de Pragas</Text>
                <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>Receber alertas sobre pragas na região</Text>
              </View>
              <Switch
                value={notifyAlerts}
                onValueChange={setNotifyAlerts}
                trackColor={{ false: colors.border, true: colors.primary + '50' }}
                thumbColor={notifyAlerts ? colors.primary : colors.textTertiary}
              />
            </View>
            
            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Previsão do Tempo</Text>
                <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>Alertas de chuva e condições climáticas</Text>
              </View>
              <Switch
                value={notifyWeather}
                onValueChange={setNotifyWeather}
                trackColor={{ false: colors.border, true: colors.primary + '50' }}
                thumbColor={notifyWeather ? colors.primary : colors.textTertiary}
              />
            </View>
            
            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Lembretes de Tarefas</Text>
                <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>Notificar sobre tarefas pendentes</Text>
              </View>
              <Switch
                value={notifyTasks}
                onValueChange={setNotifyTasks}
                trackColor={{ false: colors.border, true: colors.primary + '50' }}
                thumbColor={notifyTasks ? colors.primary : colors.textTertiary}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal - Idioma */}
      <Modal
        visible={showLanguage}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguage(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLanguage(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Idioma</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => setShowLanguage(false)}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>🇧🇷 Português (Brasil)</Text>
              <Ionicons name="checkmark" size={24} color={colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => Alert.alert('Em breve', 'Inglês estará disponível em breve!')}
            >
              <Text style={[styles.optionText, { color: colors.textSecondary }]}>🇺🇸 English (em breve)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => Alert.alert('Em breve', 'Espanhol estará disponível em breve!')}
            >
              <Text style={[styles.optionText, { color: colors.textSecondary }]}>🇪🇸 Español (em breve)</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal - Unidades */}
      <Modal
        visible={showUnits}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUnits(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUnits(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Unidades de Medida</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ÁREA</Text>
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => setAreaUnit('hectares')}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>Hectares (ha)</Text>
              {areaUnit === 'hectares' && <Ionicons name="checkmark" size={24} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => setAreaUnit('alqueires')}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>Alqueires</Text>
              {areaUnit === 'alqueires' && <Ionicons name="checkmark" size={24} color={colors.primary} />}
            </TouchableOpacity>
            
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.lg }]}>DISTÂNCIA</Text>
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => setDistanceUnit('km')}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>Quilômetros (km)</Text>
              {distanceUnit === 'km' && <Ionicons name="checkmark" size={24} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.optionRow, { borderBottomColor: colors.border }]}
              onPress={() => setDistanceUnit('milhas')}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>Milhas</Text>
              {distanceUnit === 'milhas' && <Ionicons name="checkmark" size={24} color={colors.primary} />}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
