import React, { useEffect, useState } from "react";
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
  const {
    connection,
    demoUsers,
    login,
    authLoading,
    authError,
  } = useBanking();
  const [username, setUsername] = useState("Mau");
  const [password, setPassword] = useState("1234");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!username && demoUsers[0]?.username) {
      setUsername(demoUsers[0].username);
    }
  }, [demoUsers, username]);

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
              Habla o escribe. La interfaz se adapta a lo que necesitas.
            </Text>
            <View style={styles.heroDecorationOne} />
            <View style={styles.heroDecorationTwo} />
          </View>

          <View style={[styles.loginCard, shadow]}>
            <View style={styles.cardHeading}>
              <View>
                <Text style={styles.cardTitle}>Inicia sesión</Text>
                <Text style={styles.cardSubtitle}>
                  Selecciona una identidad para la demo
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

            <Text style={styles.groupLabel}>CUENTAS DISPONIBLES</Text>
            <View style={styles.userGrid}>
              {demoUsers.map((user) => {
                const selected =
                  user.username?.toLowerCase() === username.toLowerCase();
                return (
                  <Pressable
                    key={user.id || user.username}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setUsername(user.username)}
                    style={({ pressed }) => [
                      styles.userChip,
                      selected && styles.userChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.userAvatar,
                        selected && styles.userAvatarSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.userInitial,
                          selected && styles.userInitialSelected,
                        ]}
                      >
                        {(user.name || user.username)
                          .slice(0, 1)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.userChipText,
                        selected && styles.userChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {user.username}
                    </Text>
                  </Pressable>
                );
              })}
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
                  returnKeyType="next"
                  placeholder="Tu usuario"
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
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  placeholder="Contraseña"
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

            <View style={styles.demoNote}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={colors.slate}
              />
              <Text style={styles.demoText}>
                Acceso de demostración · contraseña maestra{" "}
                <Text style={styles.demoPassword}>1234</Text>
              </Text>
            </View>
          </View>

          <View style={styles.techRow}>
            <Text style={styles.techText}>LLM</Text>
            <View style={styles.techDot} />
            <Text style={styles.techText}>MCP</Text>
            <View style={styles.techDot} />
            <Text style={styles.techText}>A2UI en tiempo real</Text>
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
    minHeight: 280,
    overflow: "hidden",
    backgroundColor: colors.red,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 70,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 39,
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
    marginTop: -46,
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
  groupLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 7,
  },
  userGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.lg,
  },
  userChip: {
    flex: 1,
    minWidth: 58,
    minHeight: 66,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  userChipSelected: {
    borderColor: colors.red,
    backgroundColor: "#FFF5F7",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.canvasStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  userAvatarSelected: {
    backgroundColor: colors.red,
  },
  userInitial: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    fontWeight: "800",
  },
  userInitialSelected: {
    color: colors.surface,
  },
  userChipText: {
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
  },
  userChipTextSelected: {
    color: colors.red,
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
  demoNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  demoText: {
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    marginLeft: 5,
  },
  demoPassword: {
    color: colors.charcoal,
    fontWeight: "800",
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
  pressed: {
    opacity: 0.65,
  },
});
