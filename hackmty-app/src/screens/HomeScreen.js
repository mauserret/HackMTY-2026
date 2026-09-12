import React, { useCallback, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import AccountOverview from "../components/AccountOverview";
import BrandMark from "../components/BrandMark";
import Composer from "../components/Composer";
import ConnectionPill from "../components/ConnectionPill";
import DynamicUI from "../components/DynamicUI";
import NotificationBanner from "../components/NotificationBanner";
import { useBanking } from "../context/BankingContext";
import { colors, fontFamily, radii, spacing } from "../theme";

const WELCOME_UI = {
  type: "ui",
  component: "quick_actions",
  props: {
    title: "¿Qué quieres resolver hoy?",
    message:
      "Descríbelo como se lo dirías a una persona. Construiré la interfaz adecuada para ti.",
  },
};

export default function HomeScreen() {
  const {
    connection,
    session,
    overview,
    messages,
    assistantStatus,
    notification,
    logout,
    sendMessage,
    sendAudio,
    confirmTransfer,
    rateInteraction,
    dismissNotification,
  } = useBanking();
  const listRef = useRef(null);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.role === "user") {
        return (
          <View style={styles.userMessageRow}>
            <View style={styles.userBubble}>
              {item.inputMode === "voice" ? (
                <View style={styles.voiceLabel}>
                  <Ionicons
                    name="mic"
                    size={11}
                    color="#FFD5DC"
                  />
                  <Text style={styles.voiceLabelText}>DICTADO</Text>
                </View>
              ) : null}
              <Text style={styles.userText}>{item.data.text}</Text>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.assistantMessageRow}>
          <View style={styles.agentMarker}>
            <Ionicons
              name="sparkles"
              size={13}
              color={colors.surface}
            />
          </View>
          <View style={styles.generatedContent}>
            <DynamicUI
              message={item.data}
              onConfirmTransfer={confirmTransfer}
              onSendMessage={sendMessage}
              onRate={rateInteraction}
              savedRating={item.rating}
            />
          </View>
        </View>
      );
    },
    [confirmTransfer, rateInteraction, sendMessage]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <BrandMark inverse compact />
          <View style={styles.headerActions}>
            <ConnectionPill state={connection} inverse />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar de usuario"
              onPress={logout}
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitial}>
                  {session?.name?.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Ionicons
                name="swap-horizontal"
                size={17}
                color={colors.surface}
              />
            </Pressable>
          </View>
        </View>

        <AccountOverview overview={overview} user={session} />

        <View style={styles.canvasHeading}>
          <View>
            <Text style={styles.canvasEyebrow}>LIENZO A2UI</Text>
            <Text style={styles.canvasTitle}>Tu espacio inteligente</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
        </View>

        {connection !== "connected" ? (
          <View style={styles.offlineBar}>
            <Ionicons
              name="cloud-offline-outline"
              size={15}
              color={colors.warning}
            />
            <Text style={styles.offlineText}>
              Reconectando con tu sesión segura…
            </Text>
          </View>
        ) : null}

        <View style={styles.feed}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.feedContent,
              messages.length === 0 && styles.emptyFeedContent,
            ]}
            ListEmptyComponent={
              <View style={styles.welcomeCanvas}>
                <DynamicUI
                  message={WELCOME_UI}
                  onConfirmTransfer={confirmTransfer}
                  onSendMessage={sendMessage}
                  onRate={rateInteraction}
                />
              </View>
            }
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
          />
        </View>

        <Composer
          onSend={sendMessage}
          onSendAudio={sendAudio}
          disabled={connection !== "connected"}
          assistantStatus={assistantStatus}
        />
      </KeyboardAvoidingView>

      <NotificationBanner
        notification={notification}
        onDismiss={dismissNotification}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.red,
  },
  header: {
    minHeight: 58,
    backgroundColor: colors.red,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  profileButton: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 5,
    paddingRight: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileAvatar: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
  },
  canvasHeading: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  canvasEyebrow: {
    color: colors.red,
    fontFamily,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  canvasTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 1,
  },
  liveBadge: {
    height: 23,
    borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontFamily,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  offlineBar: {
    minHeight: 31,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  offlineText: {
    color: colors.warning,
    fontFamily,
    fontSize: 9,
    fontWeight: "600",
    marginLeft: 6,
  },
  feed: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  welcomeCanvas: {
    width: "100%",
    justifyContent: "center",
  },
  feedContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 13,
  },
  emptyFeedContent: {
    justifyContent: "center",
  },
  userMessageRow: {
    width: "100%",
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "84%",
    backgroundColor: colors.red,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  userText: {
    color: colors.surface,
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  voiceLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 3,
  },
  voiceLabelText: {
    color: "#FFD5DC",
    fontFamily,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  assistantMessageRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  agentMarker: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: colors.charcoal,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    marginTop: 3,
  },
  generatedContent: {
    flex: 1,
  },
  pressed: {
    opacity: 0.62,
  },
});
