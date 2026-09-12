import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import BrandMark from "../components/BrandMark";
import ConnectionPill from "../components/ConnectionPill";
import { useBanking } from "../context/BankingContext";
import {
  colors,
  fontFamily,
  radii,
  shadow,
  spacing,
} from "../theme";

export default function LoginScreen() {
  const { authError, authLoading, connection, login } = useBanking();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = () => login(username, password);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <BrandMark inverse />
              <ConnectionPill state={connection} inverse />
            </View>
            <Text style={styles.heroEyebrow}>BANCA GENERATIVA</Text>
            <Text style={styles.heroTitle}>
              Tu banco construye la respuesta contigo.
            </Text>
            <Text style={styles.heroBody}>
              Inicia sesión para consultar, analizar y operar tus finanzas.
            </Text>
            <View style={styles.heroDecorationOne} />
            <View style={styles.heroDecorationTwo} />
          </View>

          <View style={[styles.loginCard, shadow]}>
            <View style={styles.cardHeading}>
              <View>
                <Text style={styles.cardTitle}>Inicia sesión</Text>
                <Text style={styles.cardSubtitle}>
                  Ingresa tus credenciales de acceso
                </Text>
              </View>
              <View style={styles.lockIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={21}
                  color={colors.red}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Usuario</Text>
              <View style={styles.inputShell}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.slate}
                />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  returnKeyType="next"
                  placeholder="Escribe tu usuario"
                  placeholderTextColor={colors.disabled}
                  style={styles.input}
                  accessibilityLabel="Usuario"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Contraseña</Text>
              <View style={styles.inputShell}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.slate}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  placeholder="Escribe tu contraseña"
                  placeholderTextColor={colors.disabled}
                  style={styles.input}
                  accessibilityLabel="Contraseña"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color={colors.slate}
                  />
                </Pressable>
              </View>
            </View>

            {authError ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.red}
                />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={authLoading}
              onPress={submit}
              style={({ pressed }) => [
                styles.primaryButton,
                authLoading && styles.primaryDisabled,
                pressed && styles.primaryPressed,
              ]}
            >
              {authLoading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Continuar</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.surface}
                  />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.techRow}>
            <Text style={styles.techText}>IA</Text>
            <View style={styles.techDot} />
            <Text style={styles.techText}>MCP</Text>
            <View style={styles.techDot} />
            <Text style={styles.techText}>INTERFAZ EN TIEMPO REAL</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.red,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.canvas,
    paddingBottom: spacing.xl,
  },
  hero: {
    minHeight: 300,
    overflow: "hidden",
    backgroundColor: colors.red,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 80,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 45,
  },
  heroEyebrow: {
    color: "#FFD7DE",
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroTitle: {
    maxWidth: 330,
    color: colors.surface,
    fontFamily,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.6,
    marginTop: 7,
  },
  heroBody: {
    maxWidth: 305,
    color: "#FFE9ED",
    fontFamily,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  heroDecorationOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 35,
    borderColor: "rgba(255,255,255,0.08)",
    right: -83,
    bottom: -45,
  },
  heroDecorationTwo: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 18,
    borderColor: "rgba(255,255,255,0.07)",
    right: 36,
    top: 75,
  },
  loginCard: {
    marginHorizontal: spacing.md,
    marginTop: -54,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 22,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    marginTop: 3,
  },
  lockIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.errorSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.slate,
    fontFamily,
    fontSize: 12,
    marginBottom: 5,
  },
  inputShell: {
    minHeight: 50,
    borderRadius: radii.input,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.canvasStrong,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: colors.charcoal,
    fontFamily,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.errorSoft,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontFamily,
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 7,
  },
  primaryButton: {
    minHeight: 45,
    borderRadius: radii.button,
    backgroundColor: colors.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryPressed: {
    backgroundColor: colors.redDark,
  },
  primaryDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: colors.surface,
    fontFamily,
    fontSize: 15,
    fontWeight: "700",
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  techText: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  techDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.disabled,
    marginHorizontal: 8,
  },
});
