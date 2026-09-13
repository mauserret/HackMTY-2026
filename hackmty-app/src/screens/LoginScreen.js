import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  StatusBar, Image, Animated, 
  KeyboardAvoidingView, Platform, Easing, ActivityIndicator,
  ScrollView
} from 'react-native';
import { useFonts } from 'expo-font';
import { Feather } from '@expo/vector-icons';
import { useBanking } from '../context/BankingContext';

export default function LoginScreen({ navigation }) {
  const { authError, authLoading, login } = useBanking();

  // Carga de tipografías Gotham
  const [fontsLoaded] = useFonts({
    'Gotham-Bold': require('../assets/fonts/Gotham Bold.otf'),
    'Gotham-Black': require('../assets/fonts/Gotham Black.otf'),
  });

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSplashLoading, setIsSplashLoading] = useState(true);
  
  const [isUserFocused, setIsUserFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Animaciones
  const fadeAnim = useRef(new Animated.Value(1)).current; 
  const contentAnim = useRef(new Animated.Value(0)).current; 
  const slideUpAnim = useRef(new Animated.Value(20)).current;
  const loginAnim = useRef(new Animated.Value(0)).current;

  // 1. SPLASH SCREEN INICIAL ULTRA RÁPIDO (0.6 segundos)
  useEffect(() => {
    if (fontsLoaded) {
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(contentAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.exp), useNativeDriver: true }),
            Animated.timing(slideUpAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.exp), useNativeDriver: true })
          ])
        ]).start(() => setIsSplashLoading(false));
      }, 600); 
    }
  }, [fontsLoaded]);

  // 2. PANTALLA POST-LOGIN
  useEffect(() => {
    if (authLoading) {
      Animated.timing(loginAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      Animated.timing(loginAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }
  }, [authLoading]);

  const submit = () => {
    if (usuario && password) {
      login(usuario, password);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#EB0029" />
      </View>
    );
  }

  const loginOverlayOpacity = loginAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <View style={styles.mainContainer}>
      <StatusBar backgroundColor="#EB0029" barStyle="light-content" translucent={true} />

      {/* SPLASH SCREEN INICIAL (CENTRADO CORRECTAMENTE) */}
      {isSplashLoading && (
        <Animated.View style={[styles.splashScreen, { opacity: fadeAnim }]}>
          <Image source={require('../assets/logo.png')} style={styles.splashLogoLarge} resizeMode="contain" />
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
        </Animated.View>
      )}

      {/* PANTALLA DE CARGA POST-LOGIN (CENTRADA CORRECTAMENTE) */}
      <Animated.View style={[styles.splashScreen, { opacity: loginOverlayOpacity, zIndex: authLoading ? 999 : -1 }]}>
        <Image source={require('../assets/logo.png')} style={styles.splashLogoLarge} resizeMode="contain" />
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 24 }} />
        <Text style={styles.verifyingText}>Conectando con BAN-IA...</Text>
        <Text style={styles.subVerifyingText}>Autenticando credenciales de forma segura</Text>
      </Animated.View>

      {/* CONTENIDO PRINCIPAL DESDE ARRIBA */}
      <KeyboardAvoidingView style={styles.flexContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[
          styles.flexContainer, 
          { opacity: contentAnim, transform: [{ translateY: slideUpAnim }] }
        ]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            
            {/* HEADER ROJO INSTITUCIONAL ARRIBA */}
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Image source={require('../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
              </View>
              <Text style={styles.badge}>Ban-IA</Text>
              <Text style={styles.headerTitle}>Tu banco construye la respuesta contigo.</Text>
              <Text style={styles.headerSubtitle}>Inicia sesión para consultar, analizar y operar tus finanzas en tiempo real.</Text>
            </View>

            {/* TARJETA FLOTANTE DE ACCESO */}
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Inicia sesión</Text>
              <Text style={styles.cardDescription}>Ingresa tus credenciales de acceso autorizadas</Text>

              {/* INPUT USUARIO */}
              <Text style={styles.inputLabel}>Usuario</Text>
              <View style={[styles.inputWrapper, isUserFocused && styles.inputWrapperFocused]}>
                <Feather name="user" size={18} color={isUserFocused ? "#EB0029" : "#A2A9AD"} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu usuario"
                  placeholderTextColor="#A2A9AD"
                  value={usuario}
                  onChangeText={setUsuario}
                  onFocus={() => setIsUserFocused(true)}
                  onBlur={() => setIsUserFocused(false)}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              {/* INPUT CONTRASEÑA */}
              <Text style={styles.inputLabel}>Contraseña</Text>
              <View style={[styles.inputWrapper, isPasswordFocused && styles.inputWrapperFocused]}>
                <Feather name="lock" size={18} color={isPasswordFocused ? "#EB0029" : "#A2A9AD"} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#A2A9AD"
                  secureTextEntry={!isPasswordVisible}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                  <Feather name={isPasswordVisible ? "eye-off" : "eye"} size={20} color="#586670" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              {/* ERROR DE BACKEND */}
              {authError ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Feather name="alert-circle" size={18} color="#EB0029" />
                  <Text style={styles.errorText}>{authError}</Text>
                </View>
              ) : null}

              {/* BOTÓN PRINCIPAL */}
              <TouchableOpacity 
                style={[styles.primaryButton, authLoading && styles.primaryDisabled]} 
                activeOpacity={0.85}
                onPress={submit}
                disabled={authLoading}
              >
                <Text style={styles.primaryButtonText}>Continuar</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#EB0029' },
  flexContainer: { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  
  // Pantalla de carga fija y centrada en toda la pantalla
  splashScreen: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#EB0029', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 999 
  },
  
  splashLogoLarge: { width: 220, height: 75, tintColor: '#FFFFFF' }, 
  verifyingText: { fontFamily: 'Gotham-Bold', color: '#FFFFFF', fontSize: 16, marginTop: 20, letterSpacing: 0.5, textAlign: 'center' },
  subVerifyingText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },
  
  scrollContent: { flexGrow: 1, backgroundColor: '#F4F5F7' },

  // Header superior alineado desde arriba correctamente
  header: { 
    backgroundColor: '#EB0029', 
    paddingTop: Platform.OS === 'ios' ? 60 : 54, 
    paddingHorizontal: 24, 
    paddingBottom: 75,
    alignItems: 'flex-start',
    width: '100%'
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, alignSelf: 'flex-start' },
  headerLogo: { width: 140, height: 35, tintColor: '#FFFFFF' }, 
  badge: { fontFamily: 'Gotham-Black', color: '#FFFFFF', fontSize: 10, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase', textAlign: 'left' },
  headerTitle: { fontFamily: 'Gotham-Bold', color: '#FFFFFF', fontSize: 24, lineHeight: 30, marginBottom: 8, textAlign: 'left' },
  headerSubtitle: { color: '#FFFFFF', fontSize: 13, lineHeight: 19, opacity: 0.9, textAlign: 'left' },
  
  formCard: { 
    backgroundColor: '#FFFFFF', 
    marginHorizontal: 20, 
    marginTop: -35, 
    borderRadius: 16, 
    padding: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 12, 
    elevation: 5 
  },
  cardTitle: { fontFamily: 'Gotham-Bold', fontSize: 22, color: '#323648', marginBottom: 4 },
  cardDescription: { fontSize: 13, color: '#586670', marginBottom: 24 },
  
  inputLabel: { fontFamily: 'Gotham-Bold', fontSize: 12, color: '#323648', marginBottom: 6 },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FAFAFA', 
    borderWidth: 1, 
    borderColor: '#EAECEE', 
    borderRadius: 8, 
    marginBottom: 18 
  },
  inputWrapperFocused: { borderColor: '#EB0029', backgroundColor: '#FFFFFF' },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, paddingHorizontal: 12, height: 46, fontSize: 15, color: '#323648', fontFamily: 'Gotham-Bold' },
  eyeButton: { padding: 14 },
  
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotPasswordText: { fontFamily: 'Gotham-Bold', color: '#EB0029', fontSize: 13 },
  
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEF', padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { fontFamily: 'Gotham-Bold', fontSize: 12, color: '#EB0029', marginLeft: 8, flex: 1 },
  
  primaryButton: { 
    backgroundColor: '#EB0029', 
    height: 48, 
    borderRadius: 8, 
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#EB0029', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 6, 
    elevation: 3 
  },
  primaryDisabled: { backgroundColor: '#CFD2D3', shadowOpacity: 0 },
  primaryButtonText: { fontFamily: 'Gotham-Bold', color: '#FFFFFF', fontSize: 15, letterSpacing: 0.3 }
});