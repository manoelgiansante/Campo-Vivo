import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useRouter, Stack } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function NewFieldScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { fields, setFields } = useAppStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [soilType, setSoilType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const newField = {
      id: Date.now(),
      name: name.trim(),
      description: description.trim(),
      areaHectares: parseInt(area) || 0,
      city: city.trim(),
      state: state.trim(),
      soilType: soilType.trim(),
      isActive: true,
    };
    
    setFields([...fields, newField]);
    setLoading(false);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Novo Campo',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerLeft: () => (
            <Button
              title=""
              variant="ghost"
              onPress={() => router.back()}
              icon={<Ionicons name="close" size={24} color={colors.text} />}
            />
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Informações Básicas
              </Text>
              
              <Input
                label="Nome do Campo *"
                placeholder="Ex: Fazenda São João"
                value={name}
                onChangeText={setName}
              />
              
              <Input
                label="Descrição"
                placeholder="Descreva o campo..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              
              <Input
                label="Área (hectares)"
                placeholder="Ex: 100"
                value={area}
                onChangeText={setArea}
                keyboardType="numeric"
              />
            </Card>

            <Card style={{ marginTop: Spacing.md }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Localização
              </Text>
              
              <Input
                label="Cidade"
                placeholder="Ex: Sorriso"
                value={city}
                onChangeText={setCity}
              />
              
              <Input
                label="Estado"
                placeholder="Ex: MT"
                value={state}
                onChangeText={setState}
              />
            </Card>

            <Card style={{ marginTop: Spacing.md }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Características
              </Text>
              
              <Input
                label="Tipo de Solo"
                placeholder="Ex: Latossolo Vermelho"
                value={soilType}
                onChangeText={setSoilType}
              />
            </Card>

            <View style={styles.buttonContainer}>
              <Button
                title="Salvar Campo"
                onPress={handleSave}
                loading={loading}
                disabled={!name.trim()}
                icon={<Ionicons name="checkmark" size={20} color="#fff" />}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
  },
});
